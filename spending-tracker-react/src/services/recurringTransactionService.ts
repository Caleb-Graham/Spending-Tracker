import { PostgrestClientFactory } from "./postgrestClientFactory";

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
  nextRunAt: string;
  lastRunAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  isIncome: boolean;
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
  nextRunAt: row.NextRunAt,
  lastRunAt: row.LastRunAt,
  isActive: row.IsActive,
  createdAt: row.CreatedAt,
  updatedAt: row.UpdatedAt,
  category: row.Categories
    ? {
        categoryId: row.Categories.CategoryId,
        name: row.Categories.Name,
        type: row.Categories.Type,
      }
    : null,
});

// Calculate the next run date based on frequency and interval
export const calculateNextRunAt = (
  startAt: string,
  frequency: RecurringFrequency,
  interval: number = 1
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

// Get all recurring transactions for the current user
export const getRecurringTransactionsNeon = async (
  accessToken: string
): Promise<RecurringTransaction[]> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { data, error } = await pg
    .from("RecurringTransactions")
    .select("*")
    .order("NextRunAt", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to fetch recurring transactions");
  }

  return (data || []).map(transformRecurringTransaction);
};

// Create a new recurring transaction
export const createRecurringTransactionNeon = async (
  input: CreateRecurringTransactionInput,
  accessToken: string
): Promise<RecurringTransaction> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Amount should be positive for income, negative for expense
  const finalAmount = input.isIncome
    ? Math.abs(input.amount)
    : -Math.abs(input.amount);

  const interval = input.interval || 1;
  const nextRunAt = calculateNextRunAt(
    input.startAt,
    input.frequency,
    interval
  );

  const { data, error } = await pg
    .from("RecurringTransactions")
    .insert({
      Amount: finalAmount,
      Note: input.note,
      CategoryId: input.categoryId,
      Frequency: input.frequency,
      Interval: interval,
      StartAt: input.startAt,
      NextRunAt: nextRunAt,
      IsActive: true,
    })
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
    isActive?: boolean;
  },
  accessToken: string
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
  if (updates.isActive !== undefined) updateData.IsActive = updates.isActive;

  const { error } = await pg
    .from("RecurringTransactions")
    .update(updateData)
    .eq("RecurringTransactionId", recurringTransactionId);

  if (error) {
    throw new Error(error.message || "Failed to update recurring transaction");
  }
};

// Delete (deactivate) a recurring transaction
export const deleteRecurringTransactionNeon = async (
  recurringTransactionId: number,
  accessToken: string
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Soft delete by setting IsActive to false
  const { error } = await pg
    .from("RecurringTransactions")
    .update({ IsActive: false, UpdatedAt: new Date().toISOString() })
    .eq("RecurringTransactionId", recurringTransactionId);

  if (error) {
    throw new Error(error.message || "Failed to delete recurring transaction");
  }
};

// Hard delete a recurring transaction
export const hardDeleteRecurringTransactionNeon = async (
  recurringTransactionId: number,
  accessToken: string
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { error } = await pg
    .from("RecurringTransactions")
    .delete()
    .eq("RecurringTransactionId", recurringTransactionId);

  if (error) {
    throw new Error(error.message || "Failed to delete recurring transaction");
  }
};
