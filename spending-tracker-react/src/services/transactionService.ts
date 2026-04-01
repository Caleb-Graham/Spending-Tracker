import { PostgrestClientFactory } from "./postgrestClientFactory";
import type { RecurringTransaction } from "./recurringTransactionService";
import { generateVirtualTransactions } from "./recurringTransactionService";

export interface Transaction {
  transactionId: number | string; // Can be number or "virtual-{id}-{date}" for virtual transactions
  date: string;
  note: string;
  amount: number;
  categoryId: number;
  category: {
    categoryId: number;
    name: string;
    type: string;
  } | null;
  isIncome: boolean;
  recurringTransactionId?: number | null;
  accountId: number;
  userId?: string;
  isVirtual?: boolean; // Flag for virtual transactions
}

// ============================================================================
// Helper Functions
// ============================================================================

// Transform a database row to a Transaction object
const transformTransaction = (row: any): Transaction => ({
  transactionId: row.TransactionId,
  date: row.Date,
  note: row.Note,
  amount: row.Amount,
  categoryId: row.CategoryId,
  isIncome: row.Amount > 0,
  recurringTransactionId: row.RecurringTransactionId,
  accountId: row.AccountId,
  userId: row.UserId,
  category: row.Categories
    ? {
        categoryId: row.Categories.CategoryId,
        name: row.Categories.Name,
        type: row.Categories.Type,
      }
    : null,
  isVirtual: false,
});

// Transform a database row to a RecurringTransaction object
const transformRecurringTransactionRow = (row: any): RecurringTransaction => ({
  recurringTransactionId: row.RecurringTransactionId,
  userId: row.UserId,
  amount: row.Amount,
  note: row.Note,
  categoryId: row.CategoryId,
  frequency: row.Frequency,
  interval: row.Interval,
  startAt: row.StartAt,
  endAt: row.EndAt,
  createdAt: row.CreatedAt,
  updatedAt: row.UpdatedAt,
  accountId: row.AccountId,
  category: row.Categories
    ? {
        categoryId: row.Categories.CategoryId,
        name: row.Categories.Name,
        type: row.Categories.Type,
      }
    : null,
});

// Create a date-only key from a timestamp: "YYYY-MM-DD"
const getDateKey = (date: string): string =>
  new Date(date).toISOString().split("T")[0];

// ============================================================================
// Data Fetching
// ============================================================================

type PgClient = ReturnType<typeof PostgrestClientFactory.createClient>;

/**
 * Fetch all transactions from the DB and partition them into:
 * - visible: non-skipped transactions to display
 * - skippedKeys: Set of "recurringTxId-YYYY-MM-DD" keys for skipped slots
 */
const fetchAllTransactions = async (
  pg: PgClient,
): Promise<{ visible: Transaction[]; skippedKeys: Set<string> }> => {
  const { data, error } = await pg
    .from("Transactions")
    .select("*, Categories(CategoryId, Name, Type)")
    .order("Date", { ascending: false });

  if (error) throw new Error(error.message || "Failed to fetch transactions");

  const visible: Transaction[] = [];
  const skippedKeys = new Set<string>();

  for (const row of data || []) {
    if (row.IsSkipped === true) {
      if (row.RecurringTransactionId && row.RecurringInstanceKey) {
        skippedKeys.add(
          `${row.RecurringTransactionId}-${row.RecurringInstanceKey}`,
        );
      }
    } else {
      visible.push(transformTransaction(row));
    }
  }

  return { visible, skippedKeys };
};

/** Fetch active recurring transaction rules. */
const fetchRecurringRules = async (
  pg: PgClient,
): Promise<RecurringTransaction[]> => {
  const { data, error } = await pg
    .from("RecurringTransactions")
    .select(
      "*, Categories!FK_RecurringTransactions_Category(CategoryId, Name, Type)",
    )
    .or(`EndAt.is.null,EndAt.gte.${new Date().toISOString()}`)
    .order("StartAt", { ascending: true });

  if (error)
    throw new Error(error.message || "Failed to fetch recurring transactions");
  return (data || []).map(transformRecurringTransactionRow);
};

// ============================================================================
// Materialization & Virtual Transactions
// ============================================================================

/**
 * Materialize past virtual transactions from recurring rules.
 * Uses upsert with the DB unique index (AccountId, RecurringTransactionId,
 * RecurringInstanceKey) so concurrent sessions can't create duplicates.
 * Skips any occurrence that has been marked as skipped.
 * Returns the count of newly materialized transactions.
 */
const materializePastVirtualTransactions = async (
  recurringRules: RecurringTransaction[],
  existingTransactions: Transaction[],
  skippedKeys: Set<string>,
  pg: PgClient,
): Promise<number> => {
  if (recurringRules.length === 0) return 0;

  const now = new Date();

  // Build a set of existing instance keys to avoid unnecessary upserts
  const existingKeys = new Set<string>();
  for (const tx of existingTransactions) {
    if (tx.recurringTransactionId) {
      existingKeys.add(`${tx.recurringTransactionId}-${getDateKey(tx.date)}`);
    }
  }

  const toUpsert: Array<{
    Date: string;
    Note: string;
    Amount: number;
    CategoryId: number;
    RecurringTransactionId: number;
    RecurringInstanceKey: string;
    AccountId: number;
    UserId: string;
  }> = [];

  const seenInBatch = new Set<string>();

  for (const rule of recurringRules) {
    const occurrences = generateVirtualTransactions(
      rule,
      new Date(rule.startAt),
      now,
    );
    for (const vt of occurrences) {
      const instanceKey = getDateKey(vt.date);
      const batchKey = `${vt.recurringTransactionId!}-${instanceKey}`;
      if (
        !existingKeys.has(batchKey) &&
        !seenInBatch.has(batchKey) &&
        !skippedKeys.has(batchKey)
      ) {
        toUpsert.push({
          Date: vt.date,
          Note: vt.note,
          Amount: vt.amount,
          CategoryId: vt.categoryId,
          RecurringTransactionId: vt.recurringTransactionId!,
          RecurringInstanceKey: instanceKey,
          AccountId: vt.accountId,
          UserId: vt.userId!,
        });
        seenInBatch.add(batchKey);
      }
    }
  }

  if (toUpsert.length > 0) {
    const { error } = await pg.from("Transactions").upsert(toUpsert, {
      ignoreDuplicates: true,
    });
    // 23505 = duplicate key — row already exists, which is fine.
    // This can happen when two sessions materialize concurrently.
    if (error && error.code !== "23505") {
      console.error("Failed to materialize transactions:", error);
    }
  }

  return toUpsert.length;
};

/**
 * Generate future virtual transactions from recurring rules,
 * excluding any that already exist as real (materialized) transactions
 * or are marked as skipped.
 */
const buildFutureVirtuals = (
  recurringRules: RecurringTransaction[],
  realTransactions: Transaction[],
  skippedKeys: Set<string>,
  options?: { startDate?: Date; endDate?: Date },
): Transaction[] => {
  const now = new Date();
  const futureEnd = options?.endDate || new Date(now.getFullYear() + 5, 11, 31);
  const futureStart =
    options?.startDate && options.startDate > now ? options.startDate : now;

  // Keys of already-materialized real transactions
  const materializedKeys = new Set<string>();
  for (const tx of realTransactions) {
    if (tx.recurringTransactionId) {
      materializedKeys.add(
        `${tx.recurringTransactionId}-${getDateKey(tx.date)}`,
      );
    }
  }

  const virtuals: Transaction[] = [];

  for (const rule of recurringRules) {
    for (const vt of generateVirtualTransactions(
      rule,
      futureStart,
      futureEnd,
    )) {
      const key = `${vt.recurringTransactionId!}-${getDateKey(vt.date)}`;
      if (!materializedKeys.has(key) && !skippedKeys.has(key)) {
        virtuals.push(vt);
      }
    }
  }

  return virtuals;
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch all transactions including virtual future transactions from recurring rules.
 * Automatically materializes any past virtual transactions that haven't been
 * inserted into the DB yet. Uses DB-level unique constraint to prevent duplicates.
 */
export const getTransactionsNeon = async (
  accessToken: string,
  options?: { startDate?: Date; endDate?: Date },
): Promise<Transaction[]> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // 1. Fetch real transactions (with skipped keys) and recurring rules in parallel
  let [{ visible: realTransactions, skippedKeys }, recurringRules] =
    await Promise.all([fetchAllTransactions(pg), fetchRecurringRules(pg)]);

  // 2. Materialize any past recurring occurrences not yet in the DB
  const materializedCount = await materializePastVirtualTransactions(
    recurringRules,
    realTransactions,
    skippedKeys,
    pg,
  );
  if (materializedCount > 0) {
    ({ visible: realTransactions, skippedKeys } =
      await fetchAllTransactions(pg));
  }

  // 3. Generate future virtual transactions (excluding skipped ones)
  const virtuals = buildFutureVirtuals(
    recurringRules,
    realTransactions,
    skippedKeys,
    options,
  );

  // 4. Merge and sort by date descending
  return [...realTransactions, ...virtuals].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
};

// ============================================================================
// CRUD Operations
// ============================================================================

export const updateTransactionNeon = async (
  transactionId: number,
  updates: {
    date?: string;
    note?: string;
    amount?: number;
    categoryId?: number | null;
  },
  accessToken: string,
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const updateData: Record<string, any> = {};
  if (updates.date !== undefined) updateData.Date = updates.date;
  if (updates.note !== undefined) updateData.Note = updates.note;
  if (updates.amount !== undefined) updateData.Amount = updates.amount;
  if (updates.categoryId !== undefined)
    updateData.CategoryId = updates.categoryId;

  const { error } = await pg
    .from("Transactions")
    .update(updateData)
    .eq("TransactionId", transactionId);

  if (error) {
    throw new Error(error.message || "Failed to update transaction");
  }
};

export const createTransactionNeon = async (
  transaction: {
    date: string;
    note: string;
    amount: number;
    categoryId?: number | null;
    isIncome: boolean;
    accountId: number;
    recurringTransactionId?: number;
    userId?: string; // Optional userId to preserve original owner
  },
  accessToken: string,
): Promise<Transaction> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Amount should be positive for income, negative for expense
  const finalAmount = transaction.isIncome
    ? Math.abs(transaction.amount)
    : -Math.abs(transaction.amount);

  const insertData: Record<string, any> = {
    Date: transaction.date,
    Note: transaction.note,
    Amount: finalAmount,
    CategoryId: transaction.categoryId || null,
    AccountId: transaction.accountId,
  };

  if (transaction.recurringTransactionId) {
    insertData.RecurringTransactionId = transaction.recurringTransactionId;
  }

  // If userId is provided, set it explicitly (for preserving original owner)
  if (transaction.userId) {
    insertData.UserId = transaction.userId;
  }

  // Insert with category join to get full transaction object back
  const { data, error } = await pg
    .from("Transactions")
    .insert(insertData)
    .select(
      "TransactionId, Date, Note, Amount, CategoryId, RecurringTransactionId, AccountId, UserId, Categories(CategoryId, Name, Type)",
    );

  if (error) {
    throw new Error(error.message || "Failed to create transaction");
  }

  if (!data || data.length === 0) {
    throw new Error("Failed to create transaction");
  }

  return transformTransaction(data[0]);
};

export const deleteTransactionNeon = async (
  transactionId: number,
  accessToken: string,
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { error } = await pg
    .from("Transactions")
    .delete()
    .eq("TransactionId", transactionId);

  if (error) {
    throw new Error(error.message || "Failed to delete transaction");
  }
};

/**
 * Skip a single recurring occurrence by upserting a row with IsSkipped = true.
 * Uses the unique index (AccountId, RecurringTransactionId, RecurringInstanceKey)
 * so that if a materialized row already exists it gets marked as skipped,
 * and if none exists yet a placeholder is created.
 */
export const skipRecurringInstanceNeon = async (
  recurringTransactionId: number,
  instanceDate: string,
  accountId: number,
  accessToken: string,
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);
  const instanceKey = getDateKey(instanceDate);

  // First try to find an existing materialized row
  const { data: existing } = await pg
    .from("Transactions")
    .select("TransactionId")
    .eq("RecurringTransactionId", recurringTransactionId)
    .eq("RecurringInstanceKey", instanceKey)
    .eq("AccountId", accountId)
    .limit(1);

  if (existing && existing.length > 0) {
    // Mark the existing row as skipped
    const { error } = await pg
      .from("Transactions")
      .update({ IsSkipped: true })
      .eq("TransactionId", existing[0].TransactionId);
    if (error) throw new Error(error.message || "Failed to skip occurrence");
  } else {
    // Insert a skipped placeholder so it won't be materialized or shown as virtual
    const { error } = await pg.from("Transactions").upsert(
      {
        Date: instanceDate,
        Note: "",
        Amount: 0,
        CategoryId: 1, // placeholder — won't be displayed
        RecurringTransactionId: recurringTransactionId,
        RecurringInstanceKey: instanceKey,
        AccountId: accountId,
        IsSkipped: true,
      },
      {
        onConflict: "AccountId,RecurringTransactionId,RecurringInstanceKey",
        ignoreDuplicates: false,
      },
    );
    if (error) throw new Error(error.message || "Failed to skip occurrence");
  }
};
