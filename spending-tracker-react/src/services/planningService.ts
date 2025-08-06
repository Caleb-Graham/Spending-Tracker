import { API_BASE_URL } from "./apiConfig";

export interface PlanningBudget {
  planningBudgetId: number;
  categoryId: number;
  year: number;
  plannedAmount: number;
  createdAt: string;
  updatedAt: string;
  category: {
    categoryId: number;
    name: string;
    type: string;
  };
}

export interface SavePlanningBudgetRequest {
  categoryId: number;
  year: number;
  plannedAmount: number;
}

export const planningService = {
  // Get all planning budgets for a specific year
  getPlanningBudgets: async (year: number): Promise<PlanningBudget[]> => {
    const response = await fetch(`${API_BASE_URL}/planning/${year}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch planning budgets");
    }

    return response.json();
  },

  // Get planning budget for a specific category and year
  getPlanningBudget: async (
    categoryId: number,
    year: number
  ): Promise<PlanningBudget | null> => {
    const response = await fetch(
      `${API_BASE_URL}/planning/${categoryId}/${year}`
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch planning budget");
    }

    return response.json();
  },

  // Save or update planning budget
  savePlanningBudget: async (
    request: SavePlanningBudgetRequest
  ): Promise<PlanningBudget> => {
    const response = await fetch(`${API_BASE_URL}/planning/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to save planning budget");
    }

    return response.json();
  },

  // Delete planning budget
  deletePlanningBudget: async (
    categoryId: number,
    year: number
  ): Promise<void> => {
    const response = await fetch(
      `${API_BASE_URL}/planning/${categoryId}/${year}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete planning budget");
    }
  },
};
