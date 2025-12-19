import { PostgrestClientFactory } from "./postgrestClientFactory";

export interface CategorySummary {
  categoryId: number;
  categoryName: string;
  amount: number;
  percentage: number;
}

export interface DetailedCategorySummary {
  categoryId: number;
  categoryName: string;
  amount: number;
  percentage: number;
  parentCategoryId?: number;
  parentCategoryName?: string;
  type: string;
}

export interface Category {
  categoryId: number;
  name: string;
  type: string;
  parentCategoryId?: number;
  parentCategoryName?: string;
}

export interface CategoryMapping {
  categoryId: number;
  categoryName: string;
  parentCategoryId: number;
  parentCategoryName: string;
}

export interface CreateCategoryMappingRequest {
  categoryName: string;
  type: string;
  parentCategoryId?: number;
  parentCategoryName?: string;
}

export interface UpdateCategoryMappingRequest {
  categoryName: string;
  parentCategoryId?: number;
  parentCategoryName?: string;
}

export interface CreateParentCategoryRequest {
  name: string;
  type: string;
}

export interface UpdateParentCategoryRequest {
  name: string;
  type: string;
}

// Neon Data API versions of summary functions
export const getCategorySummaryNeon = async (
  accessToken: string,
  startDate?: string,
  endDate?: string
): Promise<CategorySummary[]> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Build query - get expense transactions (Amount < 0) with category joins
  // Use explicit foreign key syntax: Categories!CategoryId to specify the join column
  let query = pg
    .from("Transactions")
    .select(
      `
      Amount,
      Categories!CategoryId(CategoryId, Name, Type, ParentCategoryId, ParentCategory:Categories!ParentCategoryId(CategoryId, Name))
    `
    )
    .lt("Amount", 0); // Only expenses

  if (startDate) {
    query = query.gte("Date", startDate);
  }
  if (endDate) {
    query = query.lte("Date", endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to fetch category summary");
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Group by parent category (similar to backend logic)
  const categoryMap = new Map<
    number,
    { categoryId: number; categoryName: string; totalAmount: number }
  >();

  data.forEach((row: any) => {
    const category = row.Categories;
    const parentCategory = category.ParentCategory;

    // Use parent category if it exists, otherwise use the category itself
    const categoryId = parentCategory?.CategoryId || category.CategoryId;
    const categoryName = parentCategory?.Name || category.Name;

    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, {
        categoryId,
        categoryName: categoryName || "Uncategorized",
        totalAmount: 0,
      });
    }

    const entry = categoryMap.get(categoryId)!;
    entry.totalAmount += row.Amount; // Sum negative amounts
  });

  // Calculate total spending and percentages
  const categories = Array.from(categoryMap.values());
  const totalSpending = categories.reduce(
    (sum, cat) => sum + Math.abs(cat.totalAmount),
    0
  );

  const result = categories
    .map((cat) => ({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      amount: Math.abs(cat.totalAmount), // Make positive
      percentage:
        totalSpending > 0
          ? (Math.abs(cat.totalAmount) / totalSpending) * 100
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount); // Order by highest spending first

  return result;
};

export const getDetailedCategorySummaryNeon = async (
  accessToken: string,
  startDate?: string,
  endDate?: string
): Promise<DetailedCategorySummary[]> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Build query - get expense transactions with category details
  // Use explicit foreign key syntax: Categories!CategoryId
  let query = pg
    .from("Transactions")
    .select(
      `
      Amount,
      Categories!CategoryId(CategoryId, Name, Type, ParentCategoryId, ParentCategory:Categories!ParentCategoryId(CategoryId, Name))
    `
    )
    .lt("Amount", 0); // Only expenses

  if (startDate) {
    query = query.gte("Date", startDate);
  }
  if (endDate) {
    query = query.lte("Date", endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      error.message || "Failed to fetch detailed category summary"
    );
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Group by actual category (not parent) to get detailed breakdown
  const categoryMap = new Map<
    number,
    {
      categoryId: number;
      categoryName: string;
      totalAmount: number;
      parentCategoryId?: number;
      parentCategoryName?: string;
      type: string;
    }
  >();

  data.forEach((row: any) => {
    const category = row.Categories;
    const parentCategory = category.ParentCategory;

    if (!categoryMap.has(category.CategoryId)) {
      let parentName: string | undefined;

      // Handle different possible response formats for ParentCategory
      if (parentCategory) {
        if (Array.isArray(parentCategory) && parentCategory.length > 0) {
          parentName = parentCategory[0]?.Name;
        } else if (parentCategory.Name) {
          parentName = parentCategory.Name;
        }
      }

      categoryMap.set(category.CategoryId, {
        categoryId: category.CategoryId,
        categoryName: category.Name || "Uncategorized",
        totalAmount: 0,
        parentCategoryId: category.ParentCategoryId,
        parentCategoryName: parentName,
        type: category.Type,
      });
    }

    const entry = categoryMap.get(category.CategoryId)!;
    entry.totalAmount += row.Amount; // Sum negative amounts
  });

  // Calculate total spending and percentages
  const categories = Array.from(categoryMap.values());
  const totalSpending = categories.reduce(
    (sum, cat) => sum + Math.abs(cat.totalAmount),
    0
  );

  const result = categories
    .map((cat) => ({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      amount: Math.abs(cat.totalAmount), // Make positive
      percentage:
        totalSpending > 0
          ? (Math.abs(cat.totalAmount) / totalSpending) * 100
          : 0,
      parentCategoryId: cat.parentCategoryId,
      parentCategoryName: cat.parentCategoryName,
      type: cat.type,
    }))
    .sort((a, b) => b.amount - a.amount); // Order by highest spending first

  return result;
};

export const getIncomeExpenseSummaryNeon = async (
  accessToken: string,
  startDate?: string,
  endDate?: string
): Promise<{ income: CategorySummary[]; expenses: CategorySummary[] }> => {
  try {
    const pg = PostgrestClientFactory.createClient(accessToken);

    // Fetch income transactions (Amount > 0)
    // Use explicit foreign key syntax: Categories!CategoryId
    let incomeQuery = pg
      .from("Transactions")
      .select(
        `
        Amount,
        Categories!CategoryId(CategoryId, Name, Type, ParentCategoryId, ParentCategory:Categories!ParentCategoryId(Name))
      `
      )
      .gt("Amount", 0);

    if (startDate) {
      incomeQuery = incomeQuery.gte("Date", startDate);
    }
    if (endDate) {
      incomeQuery = incomeQuery.lte("Date", endDate);
    }

    const { data: incomeData, error: incomeError } = await incomeQuery;

    if (incomeError) {
      throw new Error(incomeError.message || "Failed to fetch income data");
    }

    // Fetch expense transactions (Amount < 0)
    // Use explicit foreign key syntax: Categories!CategoryId
    let expenseQuery = pg
      .from("Transactions")
      .select(
        `
        Amount,
        Categories!CategoryId(CategoryId, Name, Type, ParentCategoryId, ParentCategory:Categories!ParentCategoryId(CategoryId, Name))
      `
      )
      .lt("Amount", 0);

    if (startDate) {
      expenseQuery = expenseQuery.gte("Date", startDate);
    }
    if (endDate) {
      expenseQuery = expenseQuery.lte("Date", endDate);
    }

    const { data: expenseData, error: expenseError } = await expenseQuery;

    if (expenseError) {
      throw new Error(expenseError.message || "Failed to fetch expense data");
    }

    // Process income data - group by category and filter for Income parent
    const incomeMap = new Map<
      number,
      { categoryId: number; categoryName: string; totalAmount: number }
    >();

    incomeData?.forEach((row: any) => {
      const category = row.Categories;
      // const parentCategory = category.ParentCategory;

      // For income, we'll include all positive transactions regardless of category structure
      // since Amount > 0 already filters to income transactions
      if (!incomeMap.has(category.CategoryId)) {
        incomeMap.set(category.CategoryId, {
          categoryId: category.CategoryId,
          categoryName: category.Name,
          totalAmount: 0,
        });
      }

      const entry = incomeMap.get(category.CategoryId)!;
      entry.totalAmount += row.Amount;
    });

    // Process expense data - group by parent category
    const expenseMap = new Map<
      number,
      { categoryId: number; categoryName: string; totalAmount: number }
    >();

    expenseData?.forEach((row: any) => {
      const category = row.Categories;
      const parentCategory = category.ParentCategory;

      const categoryId = parentCategory?.CategoryId || category.CategoryId;
      const categoryName = parentCategory?.Name || category.Name;

      if (!expenseMap.has(categoryId)) {
        expenseMap.set(categoryId, {
          categoryId,
          categoryName: categoryName || "Uncategorized",
          totalAmount: 0,
        });
      }

      const entry = expenseMap.get(categoryId)!;
      entry.totalAmount += row.Amount; // Sum negative amounts
    });

    // Calculate totals and percentages for income
    const incomeCategories = Array.from(incomeMap.values());
    const totalIncome = incomeCategories.reduce(
      (sum, cat) => sum + cat.totalAmount,
      0
    );

    const incomeSummary = incomeCategories
      .map((cat) => ({
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        amount: cat.totalAmount,
        percentage: totalIncome > 0 ? (cat.totalAmount / totalIncome) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Calculate totals and percentages for expenses
    const expenseCategories = Array.from(expenseMap.values());
    const totalExpenses = expenseCategories.reduce(
      (sum, cat) => sum + Math.abs(cat.totalAmount),
      0
    );

    const expenseSummary = expenseCategories
      .map((cat) => ({
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        amount: Math.abs(cat.totalAmount),
        percentage:
          totalExpenses > 0
            ? (Math.abs(cat.totalAmount) / totalExpenses) * 100
            : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      income: incomeSummary,
      expenses: expenseSummary,
    };
  } catch (error) {
    console.error("Failed to load income/expense summary:", error);
    return { income: [], expenses: [] };
  }
};

// Category Management API functions
// Neon Data API version
export const getAllCategoriesNeon = async (
  accessToken: string
): Promise<Category[]> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Join with ParentCategory to get parent name, similar to CategoryMethods.GetAllCategoriesAsync
  const { data, error } = await pg
    .from("Categories")
    .select(
      `
      CategoryId,
      Name,
      Type,
      ParentCategoryId,
      ParentCategory:Categories!ParentCategoryId(Name)
    `
    )
    .order("Name", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to fetch categories");
  }

  // Transform PascalCase to camelCase
  const categories =
    data?.map((row: any) => ({
      categoryId: row.CategoryId,
      name: row.Name,
      type: row.Type,
      parentCategoryId: row.ParentCategoryId,
      parentCategoryName: row.ParentCategory?.Name,
    })) || [];

  return categories;
};

// Combined function to fetch all category data in a single request
export const getAllCategoryDataNeon = async (
  accessToken: string
): Promise<{
  allCategories: Category[];
  parentCategories: Category[];
  categoryMappings: CategoryMapping[];
}> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Fetch all categories with parent information in one query
  const { data, error } = await pg
    .from("Categories")
    .select(
      `
      CategoryId,
      Name,
      Type,
      ParentCategoryId,
      ParentCategory:Categories!ParentCategoryId(Name)
    `
    )
    .order("Name", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to fetch categories");
  }

  if (!data) {
    return {
      allCategories: [],
      parentCategories: [],
      categoryMappings: [],
    };
  }

  // Transform and separate into different structures
  const allCategories = data.map((row: any) => ({
    categoryId: row.CategoryId,
    name: row.Name,
    type: row.Type,
    parentCategoryId: row.ParentCategoryId,
    parentCategoryName: row.ParentCategory?.Name,
  }));

  const parentCategories = allCategories.filter((cat) => !cat.parentCategoryId);

  const categoryMappings = allCategories
    .filter((cat) => cat.parentCategoryId)
    .map((cat) => ({
      categoryId: cat.categoryId,
      categoryName: cat.name,
      parentCategoryId: cat.parentCategoryId!,
      parentCategoryName: cat.parentCategoryName || "Unknown",
    }));

  return {
    allCategories,
    parentCategories,
    categoryMappings,
  };
};

export const getParentCategoriesNeon = async (
  accessToken: string,
  type?: string
): Promise<Category[]> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  let query = pg.from("Categories").select("*");

  if (type) {
    query = query.eq("Type", type);
  }

  // Filter for parent categories (no parent or ParentCategoryId is null)
  query = query.filter("ParentCategoryId", "is", null);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to fetch parent categories");
  }

  if (!data) {
    return [];
  }

  return data.map((row: any) => ({
    categoryId: row.CategoryId,
    name: row.Name,
    type: row.Type,
    parentCategoryId: row.ParentCategoryId,
    parentCategoryName: row.ParentCategoryName,
  }));
};

export const getCategoryMappingsNeon = async (
  accessToken: string,
  type?: string
): Promise<CategoryMapping[]> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // First, fetch all child categories (those with a ParentCategoryId)
  let query = pg
    .from("Categories")
    .select("*")
    .not("ParentCategoryId", "is", null);

  // Filter by type if provided
  if (type) {
    query = query.eq("Type", type);
  }

  const { data: childCategories, error } = await query;

  if (error) {
    console.error("getCategoryMappingsNeon error:", error);
    throw new Error(error.message || "Failed to fetch category mappings");
  }

  if (!childCategories || childCategories.length === 0) {
    return [];
  }

  // Now fetch all parent categories to get their names
  const { data: allCategories } = await pg.from("Categories").select("*");

  const categoryNameMap = new Map();
  allCategories?.forEach((cat: any) => {
    categoryNameMap.set(cat.CategoryId, cat.Name);
  });

  return childCategories.map((row: any) => ({
    categoryId: row.CategoryId,
    categoryName: row.Name,
    parentCategoryId: row.ParentCategoryId,
    parentCategoryName: categoryNameMap.get(row.ParentCategoryId) || "Unknown",
  }));
};

export const createParentCategoryNeon = async (
  accessToken: string,
  request: CreateParentCategoryRequest
): Promise<Category> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { data, error } = await pg
    .from("Categories")
    .insert([
      {
        Name: request.name,
        Type: request.type,
        ParentCategoryId: null,
      },
    ])
    .select();

  if (error) {
    throw new Error(error.message || "Failed to create parent category");
  }

  if (!data || data.length === 0) {
    throw new Error("Failed to create parent category: no data returned");
  }

  const row = data[0];
  return {
    categoryId: row.CategoryId,
    name: row.Name,
    type: row.Type,
    parentCategoryId: row.ParentCategoryId,
    parentCategoryName: row.ParentCategoryName,
  };
};

export const updateParentCategoryNeon = async (
  accessToken: string,
  categoryId: number,
  request: UpdateParentCategoryRequest
): Promise<Category> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { data, error } = await pg
    .from("Categories")
    .update({
      Name: request.name,
      Type: request.type,
    })
    .eq("CategoryId", categoryId)
    .select();

  if (error) {
    throw new Error(error.message || "Failed to update parent category");
  }

  if (!data || data.length === 0) {
    throw new Error("Failed to update parent category: category not found");
  }

  const row = data[0];
  return {
    categoryId: row.CategoryId,
    name: row.Name,
    type: row.Type,
    parentCategoryId: row.ParentCategoryId,
    parentCategoryName: row.ParentCategoryName,
  };
};

export const deleteParentCategoryNeon = async (
  accessToken: string,
  categoryId: number
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { error } = await pg
    .from("Categories")
    .delete()
    .eq("CategoryId", categoryId);

  if (error) {
    throw new Error(error.message || "Failed to delete parent category");
  }
};

export const createCategoryMappingNeon = async (
  accessToken: string,
  request: CreateCategoryMappingRequest
): Promise<CategoryMapping> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // First, resolve parentCategoryName to parentCategoryId if provided
  let finalParentCategoryId = request.parentCategoryId;

  if (request.parentCategoryName) {
    const { data: parentCategory, error: parentError } = await pg
      .from("Categories")
      .select("CategoryId")
      .eq("Name", request.parentCategoryName)
      .single();

    if (parentError || !parentCategory) {
      throw new Error(
        `Parent category "${request.parentCategoryName}" not found`
      );
    }

    finalParentCategoryId = parentCategory.CategoryId;
  }

  const { data, error } = await pg
    .from("Categories")
    .insert([
      {
        Name: request.categoryName,
        Type: request.type,
        ParentCategoryId: finalParentCategoryId,
      },
    ])
    .select("CategoryId, Name, Type, ParentCategoryId");

  if (error) {
    throw new Error(error.message || "Failed to create category mapping");
  }

  if (!data || data.length === 0) {
    throw new Error("Failed to create category mapping: no data returned");
  }

  const row = data[0];

  // Fetch parent category name
  const { data: parentData } = await pg
    .from("Categories")
    .select("Name")
    .eq("CategoryId", row.ParentCategoryId)
    .single();

  return {
    categoryId: row.CategoryId,
    categoryName: row.Name,
    parentCategoryId: row.ParentCategoryId,
    parentCategoryName: parentData?.Name || "Unknown",
  };
};

export const updateCategoryMappingNeon = async (
  accessToken: string,
  categoryId: number,
  request: UpdateCategoryMappingRequest
): Promise<CategoryMapping> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // First, resolve parentCategoryName to parentCategoryId if provided
  let finalParentCategoryId = request.parentCategoryId;

  if (request.parentCategoryName) {
    const { data: parentCategory, error: parentError } = await pg
      .from("Categories")
      .select("CategoryId")
      .eq("Name", request.parentCategoryName)
      .single();

    if (parentError || !parentCategory) {
      throw new Error(
        `Parent category "${request.parentCategoryName}" not found`
      );
    }

    finalParentCategoryId = parentCategory.CategoryId;
  }

  const { data, error } = await pg
    .from("Categories")
    .update({
      Name: request.categoryName,
      ParentCategoryId: finalParentCategoryId,
    })
    .eq("CategoryId", categoryId)
    .select("CategoryId, Name, Type, ParentCategoryId");

  if (error) {
    throw new Error(error.message || "Failed to update category mapping");
  }

  if (!data || data.length === 0) {
    throw new Error("Failed to update category mapping: category not found");
  }

  const row = data[0];

  // Fetch parent category name
  const { data: parentData } = await pg
    .from("Categories")
    .select("Name")
    .eq("CategoryId", row.ParentCategoryId)
    .single();

  return {
    categoryId: row.CategoryId,
    categoryName: row.Name,
    parentCategoryId: row.ParentCategoryId,
    parentCategoryName: parentData?.Name || "Unknown",
  };
};

export const deleteCategoryMappingNeon = async (
  accessToken: string,
  categoryId: number
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { error } = await pg
    .from("Categories")
    .delete()
    .eq("CategoryId", categoryId);

  if (error) {
    throw new Error(error.message || "Failed to delete category mapping");
  }
};
