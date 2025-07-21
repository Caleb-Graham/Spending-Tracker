import { API_BASE_URL } from "./apiConfig";

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
  parentCategoryId: number;
}

export interface UpdateCategoryMappingRequest {
  categoryName: string;
  parentCategoryId: number;
}

export interface CreateParentCategoryRequest {
  name: string;
  type: string;
}

export interface UpdateParentCategoryRequest {
  name: string;
  type: string;
}

export const getCategorySummary = async (
  startDate?: string,
  endDate?: string
): Promise<CategorySummary[]> => {
  let url = `${API_BASE_URL}/categories/summary`;
  const params = new URLSearchParams();

  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  if (params.toString()) {
    url += `?${params.toString()}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch category summary");
  }

  const result = await response.json();
  return result.data || [];
};

export const getDetailedCategorySummary = async (
  startDate?: string,
  endDate?: string
): Promise<DetailedCategorySummary[]> => {
  let url = `${API_BASE_URL}/categories/detailed-summary`;
  const params = new URLSearchParams();

  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  if (params.toString()) {
    url += `?${params.toString()}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error?.message || "Failed to fetch detailed category summary"
    );
  }

  const result = await response.json();
  return result.data || [];
};

// New function to get both income and expense summaries for Sankey diagram
export const getIncomeExpenseSummary = async (
  startDate?: string,
  endDate?: string
): Promise<{ income: CategorySummary[]; expenses: CategorySummary[] }> => {
  try {
    let url = `${API_BASE_URL}/categories/income-expense-summary`;
    const params = new URLSearchParams();

    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error?.message || "Failed to fetch income/expense summary"
      );
    }

    const result = await response.json();
    return result.data || { income: [], expenses: [] };
  } catch (error) {
    console.error("Failed to load income/expense summary:", error);
    return { income: [], expenses: [] };
  }
}; // Category Management API functions
export const getAllCategories = async (): Promise<Category[]> => {
  const response = await fetch(`${API_BASE_URL}/categories`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch categories");
  }

  const result = await response.json();
  return result.data || [];
};

export const getParentCategories = async (
  type?: string
): Promise<Category[]> => {
  const url = new URL(`${API_BASE_URL}/categories/parents`);
  if (type) {
    url.searchParams.append("type", type);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error?.message || "Failed to fetch parent categories"
    );
  }

  const result = await response.json();
  return result.data || [];
};

export const getCategoryMappings = async (
  type?: string
): Promise<CategoryMapping[]> => {
  const url = new URL(`${API_BASE_URL}/categories/mappings`);
  if (type) {
    url.searchParams.append("type", type);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error?.message || "Failed to fetch category mappings"
    );
  }

  const result = await response.json();
  return result.data || [];
};

export const createCategoryMapping = async (
  request: CreateCategoryMappingRequest
): Promise<CategoryMapping> => {
  const response = await fetch(`${API_BASE_URL}/categories/mappings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error?.message || "Failed to create category mapping"
    );
  }

  const result = await response.json();
  return result.data;
};

export const updateCategoryMapping = async (
  categoryId: number,
  request: UpdateCategoryMappingRequest
): Promise<CategoryMapping> => {
  const response = await fetch(
    `${API_BASE_URL}/categories/mappings/${categoryId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error?.message || "Failed to update category mapping"
    );
  }

  const result = await response.json();
  return result.data;
};

export const deleteCategoryMapping = async (
  categoryId: number
): Promise<void> => {
  const response = await fetch(
    `${API_BASE_URL}/categories/mappings/${categoryId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error?.message || "Failed to delete category mapping"
    );
  }
};

// Parent category management functions
export const createParentCategory = async (
  request: CreateParentCategoryRequest
): Promise<Category> => {
  const response = await fetch(`${API_BASE_URL}/categories/parents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to create parent category");
  }

  const result = await response.json();
  return result.data;
};

export const updateParentCategory = async (
  categoryId: number,
  request: UpdateParentCategoryRequest
): Promise<Category> => {
  const response = await fetch(
    `${API_BASE_URL}/categories/parents/${categoryId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to update parent category");
  }

  const result = await response.json();
  return result.data;
};

export const deleteParentCategory = async (
  categoryId: number
): Promise<void> => {
  const response = await fetch(
    `${API_BASE_URL}/categories/parents/${categoryId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to delete parent category");
  }
};
