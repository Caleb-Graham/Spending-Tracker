import { API_BASE_URL } from "./apiConfig";

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

export const scenarioService = {
  // Get all scenarios
  getScenarios: async (): Promise<Scenario[]> => {
    const response = await fetch(`${API_BASE_URL}/scenarios`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch scenarios");
    }

    return response.json();
  },

  // Get scenario by ID
  getScenario: async (scenarioId: number): Promise<Scenario> => {
    const response = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch scenario");
    }

    return response.json();
  },

  // Create new scenario
  createScenario: async (request: CreateScenarioRequest): Promise<Scenario> => {
    const response = await fetch(`${API_BASE_URL}/scenarios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create scenario");
    }

    return response.json();
  },

  // Update scenario
  updateScenario: async (
    scenarioId: number,
    request: UpdateScenarioRequest
  ): Promise<Scenario> => {
    const response = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update scenario");
    }

    return response.json();
  },

  // Delete scenario
  deleteScenario: async (scenarioId: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/scenarios/${scenarioId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete scenario");
    }
  },

  // Duplicate scenario
  duplicateScenario: async (
    sourceScenarioId: number,
    request: DuplicateScenarioRequest
  ): Promise<Scenario> => {
    const response = await fetch(
      `${API_BASE_URL}/scenarios/${sourceScenarioId}/duplicate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to duplicate scenario");
    }

    return response.json();
  },
};
