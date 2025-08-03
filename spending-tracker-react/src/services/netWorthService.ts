import { API_BASE_URL } from "./apiConfig";

export interface NetWorthSnapshot {
  snapshotId: number;
  date: string;
  netWorth: number;
  percentageChange?: number;
  dollarChange?: number;
  notes?: string;
}

export interface NetWorthAsset {
  assetId: number;
  category: string;
  name: string;
  value: number;
  isAsset: boolean;
}

export interface NetWorthDetail extends NetWorthSnapshot {
  assets: NetWorthAsset[];
}

export interface NetWorthCategory {
  category: string;
  isAsset: boolean;
  totalValue: number;
  items: NetWorthAsset[];
}

export interface NetWorthCategorySummary {
  snapshotId: number;
  date: string;
  netWorth: number;
  categories: NetWorthCategory[];
}

export interface CreateNetWorthSnapshotRequest {
  date: string;
  netWorth: number;
  percentageChange?: number;
  dollarChange?: number;
  notes?: string;
  assets: CreateNetWorthAssetRequest[];
}

export interface CreateNetWorthAssetRequest {
  category: string;
  name: string;
  value: number;
  isAsset: boolean;
}

export const getNetWorthSnapshots = async (
  startDate?: string,
  endDate?: string
): Promise<NetWorthSnapshot[]> => {
  let url = `${API_BASE_URL}/networth`;
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
      error.error?.message || "Failed to fetch net worth snapshots"
    );
  }

  const result = await response.json();
  return result.data || [];
};

export const getNetWorthDetail = async (
  snapshotId: number
): Promise<NetWorthDetail> => {
  const response = await fetch(`${API_BASE_URL}/networth/${snapshotId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch net worth detail");
  }

  const result = await response.json();
  return result.data;
};

export const getNetWorthCategorySummary = async (
  snapshotId: number
): Promise<NetWorthCategorySummary> => {
  const response = await fetch(
    `${API_BASE_URL}/networth/${snapshotId}/categories`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error?.message || "Failed to fetch net worth category summary"
    );
  }

  const result = await response.json();
  return result.data;
};

export const createNetWorthSnapshot = async (
  request: CreateNetWorthSnapshotRequest
): Promise<NetWorthSnapshot> => {
  const response = await fetch(`${API_BASE_URL}/networth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error?.message || "Failed to create net worth snapshot"
    );
  }

  const result = await response.json();
  return result.data;
};

export const deleteNetWorthSnapshot = async (
  snapshotId: number
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/networth/${snapshotId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error?.message || "Failed to delete net worth snapshot"
    );
  }
};
