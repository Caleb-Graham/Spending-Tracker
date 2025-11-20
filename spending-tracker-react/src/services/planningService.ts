import { PostgrestClientFactory } from "./postgrestClientFactory";

// Helper function to decode JWT and extract user ID
const getUserIdFromToken = (token: string): string => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const payload = JSON.parse(jsonPayload);
    return payload.sub || payload.user_id || "";
  } catch (error) {
    console.error("Failed to decode token:", error);
    return "";
  }
};

export interface PlanningBudget {
  planningBudgetId: number;
  categoryId: number;
  scenarioId: number;
  year: number;
  plannedAmount: number;
  createdAt: string;
  updatedAt: string;
  category: {
    categoryId: number;
    name: string;
    type: string;
  };
  scenario: {
    scenarioId: number;
    name: string;
    description?: string;
  };
}

export interface SavePlanningBudgetRequest {
  categoryId: number;
  scenarioId: number;
  year: number;
  plannedAmount: number;
}

// Neon Data API versions of planning functions
export const getPlanningBudgetsNeon = async (
  accessToken: string,
  scenarioId: number,
  year: number
): Promise<
  Array<{
    planningBudgetId: number;
    categoryId: number;
    scenarioId: number;
    year: number;
    plannedAmount: number;
    createdAt: string;
    updatedAt: string;
  }>
> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Get planning budgets for the scenario and year
  const { data: budgets, error: budgetsError } = await pg
    .from("PlanningBudgets")
    .select(
      "PlanningBudgetId, CategoryId, ScenarioId, Year, PlannedAmount, CreatedAt, UpdatedAt"
    )
    .eq("ScenarioId", scenarioId)
    .eq("Year", year);

  if (budgetsError) {
    throw new Error(budgetsError.message || "Failed to fetch planning budgets");
  }

  if (!budgets || budgets.length === 0) {
    return [];
  }

  // Return simplified budgets without fetching categories/scenarios
  return budgets.map((budget: any) => ({
    planningBudgetId: budget.PlanningBudgetId,
    categoryId: budget.CategoryId,
    scenarioId: budget.ScenarioId,
    year: budget.Year,
    plannedAmount: budget.PlannedAmount,
    createdAt: budget.CreatedAt,
    updatedAt: budget.UpdatedAt,
  }));
};

export const savePlanningBudgetNeon = async (
  accessToken: string,
  request: SavePlanningBudgetRequest
): Promise<PlanningBudget> => {
  const pg = PostgrestClientFactory.createClient(accessToken);
  const userId = getUserIdFromToken(accessToken);

  // Check if budget already exists
  const { data: existing } = await pg
    .from("PlanningBudgets")
    .select("PlanningBudgetId")
    .eq("CategoryId", request.categoryId)
    .eq("ScenarioId", request.scenarioId)
    .eq("Year", request.year)
    .single();

  let result;
  if (existing) {
    // Update existing
    const { data, error } = await pg
      .from("PlanningBudgets")
      .update({
        PlannedAmount: request.plannedAmount,
        UpdatedAt: new Date().toISOString(),
      })
      .eq("CategoryId", request.categoryId)
      .eq("ScenarioId", request.scenarioId)
      .eq("Year", request.year)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || "Failed to update planning budget");
    }
    result = data;
  } else {
    // Insert new with UserId
    const { data, error } = await pg
      .from("PlanningBudgets")
      .insert({
        UserId: userId,
        CategoryId: request.categoryId,
        ScenarioId: request.scenarioId,
        Year: request.year,
        PlannedAmount: request.plannedAmount,
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || "Failed to create planning budget");
    }
    result = data;
  }

  // Get category and scenario info
  const { data: category } = await pg
    .from("Categories")
    .select("CategoryId, Name, Type")
    .eq("CategoryId", request.categoryId)
    .single();

  const { data: scenario } = await pg
    .from("Scenarios")
    .select("ScenarioId, Name, Description")
    .eq("ScenarioId", request.scenarioId)
    .single();

  return {
    planningBudgetId: result.PlanningBudgetId,
    categoryId: result.CategoryId,
    scenarioId: result.ScenarioId,
    year: result.Year,
    plannedAmount: result.PlannedAmount,
    createdAt: result.CreatedAt,
    updatedAt: result.UpdatedAt,
    category: {
      categoryId: category?.CategoryId || request.categoryId,
      name: category?.Name || "",
      type: category?.Type || "",
    },
    scenario: {
      scenarioId: scenario?.ScenarioId || request.scenarioId,
      name: scenario?.Name || "",
      description: scenario?.Description,
    },
  };
};

export const deletePlanningBudgetNeon = async (
  accessToken: string,
  categoryId: number,
  scenarioId: number,
  year: number
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { error } = await pg
    .from("PlanningBudgets")
    .delete()
    .eq("CategoryId", categoryId)
    .eq("ScenarioId", scenarioId)
    .eq("Year", year);

  if (error) {
    throw new Error(error.message || "Failed to delete planning budget");
  }
};
