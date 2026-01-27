import { PostgrestClientFactory } from "./postgrestClientFactory";
import type { Transaction } from "./transactionService";

export type RecurringFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface RecurringTransaction {
  recurringTransactionId: number;
  userId: string;
  amount: number;
  note: string;
  categoryId: number;
  frequency: RecurringFrequency;
  interval: number;
  startAt: string;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
  accountId: number;
  category?: {
    categoryId: number;
    name: string;
    type: string;
  } | null;
}

export interface CreateRecurringTransactionInput {
  amount: number;
  note: string;
  categoryId: number;
  frequency: RecurringFrequency;
  interval?: number;
  startAt: string;
  endAt?: string | null; // Optional end date for the recurring transaction
  isIncome: boolean;
  accountId: number;
  userId?: string; // Optional userId to preserve original owner
}

// Transform database row to TypeScript interface
const transformRecurringTransaction = (row: any): RecurringTransaction => ({
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

// Calculate the next occurrence date based on frequency and interval
export const calculateNextOccurrence = (
  startAt: string,
  frequency: RecurringFrequency,
  interval: number = 1,
): string => {
  const date = new Date(startAt);

  switch (frequency) {
    case "DAILY":
      date.setDate(date.getDate() + interval);
      break;
    case "WEEKLY":
      date.setDate(date.getDate() + 7 * interval);
      break;
    case "MONTHLY":
      date.setMonth(date.getMonth() + interval);
      break;
    case "YEARLY":
      date.setFullYear(date.getFullYear() + interval);
      break;
  }

  return date.toISOString();
};

// Generate virtual transactions from a recurring transaction rule
export const generateVirtualTransactions = (
  recurringTx: RecurringTransaction,
  startDate: Date,
  endDate: Date,
  maxOccurrences: number = 1000,
): Transaction[] => {
  const virtualTransactions: Transaction[] = [];

  // Start from the recurring transaction's StartAt date
  let currentDate = new Date(recurringTx.startAt);

  // Find the next occurrence that is AFTER the startDate
  // We need to advance from StartAt until we get a date > startDate
  while (currentDate <= startDate) {
    const nextDateStr = calculateNextOccurrence(
      currentDate.toISOString(),
      recurringTx.frequency,
      recurringTx.interval,
    );
    currentDate = new Date(nextDateStr);
  }

  // Determine the end boundary (either endDate or EndAt, whichever comes first)
  let effectiveEndDate = new Date(endDate);
  if (recurringTx.endAt) {
    const endAtDate = new Date(recurringTx.endAt);
    if (endAtDate < effectiveEndDate) {
      effectiveEndDate = endAtDate;
    }
  }

  let occurrenceCount = 0;

  while (currentDate <= effectiveEndDate && occurrenceCount < maxOccurrences) {
    // Format date as YYYY-MM-DD for consistency
    const dateStr = currentDate.toISOString().split("T")[0];

    virtualTransactions.push({
      transactionId: `virtual-${recurringTx.recurringTransactionId}-${dateStr}`,
      date: currentDate.toISOString(),
      note: recurringTx.note,
      amount: recurringTx.amount,
      categoryId: recurringTx.categoryId,
      category: recurringTx.category || null,
      isIncome: recurringTx.amount > 0,
      recurringTransactionId: recurringTx.recurringTransactionId,
      accountId: recurringTx.accountId,
      userId: recurringTx.userId,
      isVirtual: true,
    });

    // Calculate next occurrence
    const nextDateStr = calculateNextOccurrence(
      currentDate.toISOString(),
      recurringTx.frequency,
      recurringTx.interval,
    );
    currentDate = new Date(nextDateStr);
    occurrenceCount++;
  }

  return virtualTransactions;
};

// Get all recurring transactions for the current user
export const getRecurringTransactionsNeon = async (
  accessToken: string,
): Promise<RecurringTransaction[]> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { data, error } = await pg
    .from("RecurringTransactions")
    .select("*")
    .order("StartAt", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to fetch recurring transactions");
  }

  return (data || []).map(transformRecurringTransaction);
};

// Get a single recurring transaction by ID
export const getRecurringTransactionByIdNeon = async (
  recurringTransactionId: number,
  accessToken: string,
): Promise<RecurringTransaction> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { data, error } = await pg
    .from("RecurringTransactions")
    .select("*")
    .eq("RecurringTransactionId", recurringTransactionId)
    .single();

  if (error) {
    throw new Error(error.message || "Failed to fetch recurring transaction");
  }

  if (!data) {
    throw new Error("Recurring transaction not found");
  }

  return transformRecurringTransaction(data);
};

// Create a new recurring transaction
export const createRecurringTransactionNeon = async (
  input: CreateRecurringTransactionInput,
  accessToken: string,
): Promise<RecurringTransaction> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Amount should be positive for income, negative for expense
  const finalAmount = input.isIncome
    ? Math.abs(input.amount)
    : -Math.abs(input.amount);

  const interval = input.interval || 1;

  const insertData: any = {
    Amount: finalAmount,
    Note: input.note,
    CategoryId: input.categoryId,
    Frequency: input.frequency,
    Interval: interval,
    StartAt: input.startAt,
    AccountId: input.accountId,
  };

  // If endAt is provided, set it
  if (input.endAt !== undefined) {
    insertData.EndAt = input.endAt;
  }

  // If userId is provided, set it explicitly (for preserving original owner)
  if (input.userId) {
    insertData.UserId = input.userId;
  }

  const { data, error } = await pg
    .from("RecurringTransactions")
    .insert(insertData)
    .select("*");

  if (error) {
    throw new Error(error.message || "Failed to create recurring transaction");
  }

  if (!data || data.length === 0) {
    throw new Error("Failed to create recurring transaction");
  }

  return transformRecurringTransaction(data[0]);
};

// Update a recurring transaction
export const updateRecurringTransactionNeon = async (
  recurringTransactionId: number,
  updates: {
    amount?: number;
    note?: string;
    categoryId?: number;
    frequency?: RecurringFrequency;
    interval?: number;
    endAt?: string | null;
  },
  accessToken: string,
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const updateData: any = {
    UpdatedAt: new Date().toISOString(),
  };

  if (updates.amount !== undefined) updateData.Amount = updates.amount;
  if (updates.note !== undefined) updateData.Note = updates.note;
  if (updates.categoryId !== undefined)
    updateData.CategoryId = updates.categoryId;
  if (updates.frequency !== undefined) updateData.Frequency = updates.frequency;
  if (updates.interval !== undefined) updateData.Interval = updates.interval;
  if (updates.endAt !== undefined) updateData.EndAt = updates.endAt;

  const { error } = await pg
    .from("RecurringTransactions")
    .update(updateData)
    .eq("RecurringTransactionId", recurringTransactionId);

  if (error) {
    throw new Error(error.message || "Failed to update recurring transaction");
  }
};

// Delete (stop) a recurring transaction by setting EndAt to now
export const deleteRecurringTransactionNeon = async (
  recurringTransactionId: number,
  accessToken: string,
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Hard delete the recurring transaction
  const { error } = await pg
    .from("RecurringTransactions")
    .delete()
    .eq("RecurringTransactionId", recurringTransactionId);

  if (error) {
    throw new Error(error.message || "Failed to delete recurring transaction");
  }
};
