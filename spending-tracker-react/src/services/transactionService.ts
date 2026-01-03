import { PostgrestClientFactory } from "./postgrestClientFactory";

export interface Transaction {
  transactionId: number;
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
}

// Neon Data API version
export const getTransactionsNeon = async (
  accessToken: string
): Promise<Transaction[]> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { data, error } = await pg
    .from("Transactions")
    .select(
      `
      *,
      Categories(CategoryId, Name, Type)
    `
    )
    .order("Date", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to fetch transactions");
  }

  // Transform PascalCase database columns to camelCase for TypeScript interface
  const transactions =
    data?.map((row: any) => ({
      transactionId: row.TransactionId,
      date: row.Date,
      note: row.Note,
      amount: row.Amount,
      categoryId: row.CategoryId,
      isIncome: row.Amount < 0 ? false : true, // negative = expense, positive = income
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
    })) || [];

  return transactions;
};

export const updateTransactionNeon = async (
  transactionId: number,
  updates: {
    date?: string;
    note?: string;
    amount?: number;
    categoryId?: number | null;
  },
  accessToken: string
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const updateData: any = {};
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
  },
  accessToken: string
): Promise<Transaction> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Amount should be positive for income, negative for expense
  const finalAmount = transaction.isIncome
    ? Math.abs(transaction.amount)
    : -Math.abs(transaction.amount);

  const { data, error } = await pg
    .from("Transactions")
    .insert({
      Date: transaction.date,
      Note: transaction.note,
      Amount: finalAmount,
      CategoryId: transaction.categoryId || null,
      AccountId: transaction.accountId,
    })
    .select();

  if (error) {
    throw new Error(error.message || "Failed to create transaction");
  }

  if (!data || data.length === 0) {
    throw new Error("Failed to create transaction");
  }

  const row = data[0];

  let category = null;
  if (row.CategoryId) {
    const { data: categoryData } = await pg
      .from("Categories")
      .select("CategoryId, Name, Type")
      .eq("CategoryId", row.CategoryId)
      .single();

    if (categoryData) {
      category = {
        categoryId: categoryData.CategoryId,
        name: categoryData.Name,
        type: categoryData.Type,
      };
    }
  }

  return {
    transactionId: row.TransactionId,
    date: row.Date,
    note: row.Note,
    amount: row.Amount,
    categoryId: row.CategoryId,
    isIncome: row.Amount > 0,
    accountId: row.AccountId,
    category,
  };
};
