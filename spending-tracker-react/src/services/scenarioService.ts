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

export interface Scenario {
  scenarioId: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScenarioRequest {
  name: string;
  description?: string;
}

export interface UpdateScenarioRequest {
  name: string;
  description?: string;
}

export interface DuplicateScenarioRequest {
  name: string;
  description?: string;
}

// Neon Data API versions of scenario functions
export const getScenariosNeon = async (
  accessToken: string
): Promise<Scenario[]> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { data, error } = await pg
    .from("Scenarios")
    .select("ScenarioId, Name, Description, CreatedAt, UpdatedAt")
    .order("ScenarioId", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to fetch scenarios");
  }

  if (!data) {
    return [];
  }

  return data.map((row: any) => ({
    scenarioId: row.ScenarioId,
    name: row.Name,
    description: row.Description,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  }));
};

export const createScenarioNeon = async (
  accessToken: string,
  request: CreateScenarioRequest
): Promise<Scenario> => {
  const pg = PostgrestClientFactory.createClient(accessToken);
  const userId = getUserIdFromToken(accessToken);

  const { data, error } = await pg
    .from("Scenarios")
    .insert({
      UserId: userId,
      Name: request.name,
      Description: request.description,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "Failed to create scenario");
  }

  return {
    scenarioId: data.ScenarioId,
    name: data.Name,
    description: data.Description,
    createdAt: data.CreatedAt,
    updatedAt: data.UpdatedAt,
  };
};

export const updateScenarioNeon = async (
  accessToken: string,
  scenarioId: number,
  request: UpdateScenarioRequest
): Promise<Scenario> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { data, error } = await pg
    .from("Scenarios")
    .update({
      Name: request.name,
      Description: request.description,
      UpdatedAt: new Date().toISOString(),
    })
    .eq("ScenarioId", scenarioId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "Failed to update scenario");
  }

  return {
    scenarioId: data.ScenarioId,
    name: data.Name,
    description: data.Description,
    createdAt: data.CreatedAt,
    updatedAt: data.UpdatedAt,
  };
};

export const deleteScenarioNeon = async (
  accessToken: string,
  scenarioId: number
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { error } = await pg
    .from("Scenarios")
    .delete()
    .eq("ScenarioId", scenarioId);

  if (error) {
    throw new Error(error.message || "Failed to delete scenario");
  }
};

export const duplicateScenarioNeon = async (
  accessToken: string,
  sourceScenarioId: number,
  request: DuplicateScenarioRequest
): Promise<Scenario> => {
  const pg = PostgrestClientFactory.createClient(accessToken);
  const userId = getUserIdFromToken(accessToken);

  // Create new scenario
  const { data: newScenario, error: createError } = await pg
    .from("Scenarios")
    .insert({
      UserId: userId,
      Name: request.name,
      Description: request.description,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    })
    .select()
    .single();

  if (createError) {
    throw new Error(
      createError.message || "Failed to create duplicate scenario"
    );
  }

  // Get all planning budgets from source scenario
  const { data: sourceBudgets, error: fetchError } = await pg
    .from("PlanningBudgets")
    .select("CategoryId, Year, PlannedAmount")
    .eq("ScenarioId", sourceScenarioId);

  if (fetchError) {
    throw new Error(fetchError.message || "Failed to fetch source budgets");
  }

  // Copy budgets to new scenario
  if (sourceBudgets && sourceBudgets.length > 0) {
    const newBudgets = sourceBudgets.map((budget: any) => ({
      CategoryId: budget.CategoryId,
      ScenarioId: newScenario.ScenarioId,
      Year: budget.Year,
      PlannedAmount: budget.PlannedAmount,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    }));

    const { error: insertError } = await pg
      .from("PlanningBudgets")
      .insert(newBudgets);

    if (insertError) {
      throw new Error(insertError.message || "Failed to copy planning budgets");
    }
  }

  return {
    scenarioId: newScenario.ScenarioId,
    name: newScenario.Name,
    description: newScenario.Description,
    createdAt: newScenario.CreatedAt,
    updatedAt: newScenario.UpdatedAt,
  };
};
