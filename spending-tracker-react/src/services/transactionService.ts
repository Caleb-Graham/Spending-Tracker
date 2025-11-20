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

export interface ImportResult {
  totalRecords: number;
  newTransactionsAdded: number;
  duplicatesSkipped: number;
}

interface CsvRecord {
  date: string;
  amount: number;
  note: string;
  category: string;
}

// Parse CSV file and upload to Neon Data API
export const uploadTransactionsNeon = async (
  file: File,
  accessToken: string
): Promise<ImportResult> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Read and parse CSV file
  const text = await file.text();
  const lines = text.split("\n").filter((line) => line.trim());
  const records: CsvRecord[] = [];

  // Determine delimiter (tab or comma)
  const firstDataLine = lines[1];
  const delimiter = firstDataLine.includes("\t") ? "\t" : ",";

  // Parse header to find column indices
  const headerParts = lines[0]
    .split(delimiter)
    .map((p) => p.trim().toLowerCase());
  const dateIdx = headerParts.indexOf("date");
  const categoryIdx = headerParts.indexOf("category");
  const amountIdx = headerParts.indexOf("amount");
  const noteIdx = headerParts.indexOf("note");

  if (dateIdx === -1 || categoryIdx === -1 || amountIdx === -1) {
    throw new Error("CSV must have Date, Category, and Amount columns");
  }

  // Skip header row and parse data rows
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i]
      .split(delimiter)
      .map((p) => p.trim().replace(/^"|"$/g, ""));

    if (parts.length > Math.max(dateIdx, categoryIdx, amountIdx)) {
      const amount = parseFloat(parts[amountIdx]);
      if (isNaN(amount)) {
        console.warn(
          `Skipping row ${i}: invalid amount "${parts[amountIdx]}" (category: "${parts[categoryIdx]}")`
        );
        continue;
      }
      records.push({
        date: parts[dateIdx],
        amount: amount,
        note: noteIdx !== -1 ? parts[noteIdx] : "",
        category: parts[categoryIdx],
      });
    }
  }

  if (!records.length) {
    throw new Error("No records found in the CSV file.");
  }

  // Step 1: Get all existing transactions (for duplicate checking)
  const { data: existingTransactions } = await pg
    .from("Transactions")
    .select("Date, Amount, Note");

  const existingSet = new Set(
    (existingTransactions || []).map(
      (t: any) => `${t.Date}|${t.Amount}|${t.Note}`
    )
  );

  // Step 2: Filter out duplicates
  const newRecords = records.filter(
    (r) => !existingSet.has(`${r.date}|${r.amount}|${r.note}`)
  );
  const duplicatesSkipped = records.length - newRecords.length;

  // Step 3: Get all existing categories
  const { data: allCategories } = await pg
    .from("Categories")
    .select("CategoryId, Name, Type");

  // Step 4: Identify which categories we need to create
  const categoryNames = new Set(newRecords.map((r) => r.category));
  const existingCategoryNames = new Set(
    (allCategories || []).map((c: any) => c.Name)
  );
  const newCategoryNames = Array.from(categoryNames).filter(
    (name) => !existingCategoryNames.has(name)
  );

  // Step 5: Create any missing categories (batch)
  const categoryMap = new Map(
    (allCategories || []).map((c: any) => [c.Name, c.CategoryId])
  );

  if (newCategoryNames.length > 0) {
    // Determine category types from records
    const categoryTypes = new Map<string, string>();
    for (const record of newRecords) {
      if (!categoryTypes.has(record.category)) {
        // Debug: log the amount and determine type
        console.log(
          `Category "${record.category}" amount: ${record.amount}, type: ${
            record.amount < 0 ? "Expense" : "Income"
          }`
        );
        categoryTypes.set(
          record.category,
          record.amount < 0 ? "Expense" : "Income"
        );
      }
    }

    // Get or create Unassigned parent for each type
    const unassignedMap = new Map<string, number>();
    for (const categoryType of new Set(categoryTypes.values())) {
      const { data: unassigned } = await pg
        .from("Categories")
        .select("CategoryId")
        .eq("Name", "Unassigned")
        .eq("Type", categoryType)
        .is("ParentCategoryId", null);

      let parentId: number;
      if (unassigned && unassigned.length > 0) {
        parentId = unassigned[0].CategoryId;
      } else {
        const { data: newParent } = await pg
          .from("Categories")
          .insert([
            {
              Name: "Unassigned",
              Type: categoryType,
              ParentCategoryId: null,
            },
          ])
          .select("CategoryId");
        parentId = newParent?.[0]?.CategoryId;
      }
      unassignedMap.set(categoryType, parentId);
    }

    // Batch insert new categories
    const categoriesToInsert = newCategoryNames.map((name) => ({
      Name: name,
      Type: categoryTypes.get(name) || "Expense",
      ParentCategoryId: unassignedMap.get(categoryTypes.get(name) || "Expense"),
    }));

    const { data: insertedCategories } = await pg
      .from("Categories")
      .insert(categoriesToInsert)
      .select("CategoryId, Name");

    // Add to map
    for (const cat of insertedCategories || []) {
      categoryMap.set(cat.Name, cat.CategoryId);
    }
  }

  // Step 6: Batch insert all transactions
  const transactionsToInsert = newRecords.map((record) => ({
    Date: record.date,
    Amount: record.amount,
    Note: record.note,
    CategoryId: categoryMap.get(record.category),
    // UserId will be auto-filled by the DEFAULT jwt_uid() in the database
  }));

  console.log(`Inserting ${transactionsToInsert.length} transactions`);
  const { error: insertError } = await pg
    .from("Transactions")
    .insert(transactionsToInsert);

  if (insertError) {
    throw new Error(`Failed to insert transactions: ${insertError.message}`);
  }

  return {
    totalRecords: records.length,
    newTransactionsAdded: newRecords.length,
    duplicatesSkipped,
  };
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
    .insert([
      {
        Date: transaction.date,
        Note: transaction.note,
        Amount: finalAmount,
        CategoryId: transaction.categoryId || null,
      },
    ])
    .select(
      `
      *,
      Categories(CategoryId, Name, Type)
    `
    );

  if (error) {
    throw new Error(error.message || "Failed to create transaction");
  }

  if (!data || data.length === 0) {
    throw new Error("Failed to create transaction");
  }

  const row = data[0];
  return {
    transactionId: row.TransactionId,
    date: row.Date,
    note: row.Note,
    amount: row.Amount,
    categoryId: row.CategoryId,
    isIncome: row.Amount > 0,
    category: row.Categories
      ? {
          categoryId: row.Categories.CategoryId,
          name: row.Categories.Name,
          type: row.Categories.Type,
        }
      : null,
  };
};
