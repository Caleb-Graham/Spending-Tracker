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

// Create a lookup key for deduplication
const getDateKey = (date: string): string =>
  new Date(date).toISOString().split("T")[0];

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Materialize past virtual transactions from recurring rules.
 * Only inserts transactions that don't already exist in the database.
 * Returns the count of newly materialized transactions.
 */
const materializePastVirtualTransactions = async (
  recurringTxs: RecurringTransaction[],
  existingTransactions: Transaction[],
  pg: ReturnType<typeof PostgrestClientFactory.createClient>,
): Promise<number> => {
  // Skip if no recurring transactions
  if (recurringTxs.length === 0) return 0;

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // Build lookup set for existing transactions
  const existingKeys = new Set<string>();
  for (const tx of existingTransactions) {
    if (tx.recurringTransactionId) {
      existingKeys.add(`${tx.recurringTransactionId}-${getDateKey(tx.date)}`);
    }
  }

  // Collect transactions to materialize
  const toInsert: Array<{
    Date: string;
    Note: string;
    Amount: number;
    CategoryId: number;
    RecurringTransactionId: number;
    AccountId: number;
  }> = [];

  for (const recurringTx of recurringTxs) {
    const startDate = new Date(recurringTx.startAt);
    const virtualTxs = generateVirtualTransactions(
      recurringTx,
      startDate,
      today,
    );

    for (const vt of virtualTxs) {
      const key = `${vt.recurringTransactionId}-${getDateKey(vt.date)}`;
      if (!existingKeys.has(key)) {
        toInsert.push({
          Date: vt.date,
          Note: vt.note,
          Amount: vt.amount,
          CategoryId: vt.categoryId,
          RecurringTransactionId: vt.recurringTransactionId!,
          AccountId: vt.accountId,
        });
        // Add to set to prevent duplicates within same batch
        existingKeys.add(key);
      }
    }
  }

  // Batch insert if any to materialize
  if (toInsert.length > 0) {
    const { error } = await pg.from("Transactions").insert(toInsert);
    if (error) {
      console.error("Failed to materialize transactions:", error);
      throw new Error(error.message || "Failed to materialize transactions");
    }
  }

  return toInsert.length;
};

/**
 * Fetch all transactions including virtual future transactions from recurring rules.
 * Automatically materializes any past virtual transactions.
 */
export const getTransactionsNeon = async (
  accessToken: string,
  options?: { startDate?: Date; endDate?: Date },
): Promise<Transaction[]> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Fetch real transactions and recurring rules in parallel
  const [transactionResult, recurringResult] = await Promise.all([
    pg
      .from("Transactions")
      .select("*, Categories(CategoryId, Name, Type)")
      .order("Date", { ascending: false }),
    pg
      .from("RecurringTransactions")
      .select(
        "*, Categories!FK_RecurringTransactions_Category(CategoryId, Name, Type)",
      )
      .or(`EndAt.is.null,EndAt.gte.${new Date().toISOString()}`)
      .order("StartAt", { ascending: true }),
  ]);

  if (transactionResult.error) {
    throw new Error(
      transactionResult.error.message || "Failed to fetch transactions",
    );
  }
  if (recurringResult.error) {
    throw new Error(
      recurringResult.error.message || "Failed to fetch recurring transactions",
    );
  }

  const realTransactions = (transactionResult.data || []).map(
    transformTransaction,
  );
  const recurringTxs = (recurringResult.data || []).map(
    transformRecurringTransactionRow,
  );

  // Materialize past virtual transactions
  const materializedCount = await materializePastVirtualTransactions(
    recurringTxs,
    realTransactions,
    pg,
  );

  // If we materialized any, fetch only those new transactions
  let allRealTransactions = realTransactions;
  if (materializedCount > 0) {
    const { data: updatedData } = await pg
      .from("Transactions")
      .select("*, Categories(CategoryId, Name, Type)")
      .order("Date", { ascending: false });
    allRealTransactions = (updatedData || []).map(transformTransaction);
  }

  // Generate virtual transactions for the future
  const today = new Date();
  const futureEndDate =
    options?.endDate || new Date(today.getFullYear() + 5, 11, 31);
  const futureStartDate =
    options?.startDate && options.startDate > today ? options.startDate : today;

  // Build lookup set from real transactions for deduplication
  const realTxKeys = new Set<string>();
  for (const rt of allRealTransactions) {
    if (rt.recurringTransactionId) {
      realTxKeys.add(`${rt.recurringTransactionId}-${getDateKey(rt.date)}`);
    }
  }

  // Generate and filter virtual transactions
  const virtualTransactions: Transaction[] = [];
  for (const recurringTx of recurringTxs) {
    const virtuals = generateVirtualTransactions(
      recurringTx,
      futureStartDate,
      futureEndDate,
    );
    for (const vt of virtuals) {
      const key = `${vt.recurringTransactionId}-${getDateKey(vt.date)}`;
      if (!realTxKeys.has(key)) {
        virtualTransactions.push(vt);
      }
    }
  }

  // Merge and sort all transactions by date descending
  const allTransactions = [...allRealTransactions, ...virtualTransactions];
  allTransactions.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return allTransactions;
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
