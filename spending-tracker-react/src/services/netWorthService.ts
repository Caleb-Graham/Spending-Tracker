import { PostgrestClientFactory } from "./postgrestClientFactory";

export interface NetWorthSnapshot {
  snapshotId: number;
  date: string;
  notes?: string;
  netWorth?: number;
  percentageChange?: number;
  dollarChange?: number;
}

export interface NetWorthAsset {
  accountId: number;
  category: string;
  name: string;
  value: number;
  isAsset: boolean;
}

export interface NetWorthDetail extends NetWorthSnapshot {
  assets: NetWorthAsset[];
  totalValue: number;
}

export interface NetWorthCategory {
  category: string;
  isAsset: boolean;
  totalValue: number;
  items: NetWorthAsset[];
}

export interface NetWorthCategorySummary extends NetWorthSnapshot {
  categories: NetWorthCategory[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export interface CreateNetWorthSnapshotRequest {
  date: string;
  notes?: string;
  accounts: CreateNetWorthAccountValueRequest[];
  accountId: number;
}

export interface CreateNetWorthAccountValueRequest {
  accountId: number;
  value: number;
}

export interface CreateNetWorthAccountRequest {
  name: string;
  category: string;
  isAsset: boolean;
  notes?: string;
  accountId: number;
}

export interface CreateNetWorthAssetRequest {
  name: string;
  category: string;
  isAsset: boolean;
  value: number;
}

// Get all net worth snapshots (oldest to newest)
export const getNetWorthSnapshotsNeon = async (
  accessToken: string,
  startDate?: string,
  endDate?: string
): Promise<NetWorthSnapshot[]> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  let query = pg.from("NetWorthSnapshots").select("SnapshotId, Date, Notes");

  if (startDate) {
    query = query.gte("Date", startDate);
  }
  if (endDate) {
    query = query.lte("Date", endDate);
  }

  const { data, error } = await query.order("Date", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to fetch net worth snapshots");
  }

  return (data || []).map((row: any) => ({
    snapshotId: row.SnapshotId,
    date: row.Date,
    notes: row.Notes,
  }));
};

// Get detailed snapshot with all accounts and values
export const getNetWorthDetailNeon = async (
  accessToken: string,
  snapshotId: number
): Promise<NetWorthDetail> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Fetch snapshot
  const { data: snapshotData, error: snapshotError } = await pg
    .from("NetWorthSnapshots")
    .select("SnapshotId, Date, Notes")
    .eq("SnapshotId", snapshotId)
    .single();

  if (snapshotError) {
    throw new Error("Snapshot not found");
  }

  // Fetch net worth entries with account details
  const { data: netWorthData, error: netWorthError } = await pg
    .from("NetWorth")
    .select(
      `
      NetWorthId,
      Value,
      NetWorthAccounts(AccountId, Name, IsAsset, NetWorthCategories(Name))
    `
    )
    .eq("SnapshotId", snapshotId);

  if (netWorthError) {
    throw new Error(
      netWorthError.message || "Failed to fetch net worth details"
    );
  }

  const assets = (netWorthData || []).map((row: any) => {
    const account = row.NetWorthAccounts;
    const netWorthCategory = account.NetWorthCategories;
    const categoryName = netWorthCategory?.Name || "Uncategorized";
    return {
      accountId: account.AccountId,
      category: categoryName,
      name: account.Name,
      value: parseFloat(row.Value),
      isAsset: account.IsAsset,
    };
  });

  const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);

  return {
    snapshotId: snapshotData.SnapshotId,
    date: snapshotData.Date,
    notes: snapshotData.Notes,
    assets,
    totalValue,
  };
};

// Get snapshot with categories summary
export const getNetWorthCategorySummaryNeon = async (
  accessToken: string,
  snapshotId: number
): Promise<NetWorthCategorySummary> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Fetch snapshot
  const { data: snapshotData, error: snapshotError } = await pg
    .from("NetWorthSnapshots")
    .select("SnapshotId, Date, Notes")
    .eq("SnapshotId", snapshotId)
    .single();

  if (snapshotError) {
    throw new Error("Snapshot not found");
  }

  // Fetch net worth entries with account and category details
  const { data: netWorthData, error: netWorthError } = await pg
    .from("NetWorth")
    .select(
      `
      Value,
      NetWorthAccounts(AccountId, Name, IsAsset, NetWorthCategories(CategoryId, Name))
    `
    )
    .eq("SnapshotId", snapshotId);

  if (netWorthError) {
    throw new Error(
      netWorthError.message || "Failed to fetch net worth snapshot"
    );
  }

  // Group by category
  const categories = new Map<string, NetWorthCategory>();
  let totalAssets = 0;
  let totalLiabilities = 0;

  (netWorthData || []).forEach((row: any) => {
    const account = row.NetWorthAccounts;
    const netWorthCategory = account.NetWorthCategories;
    const categoryName = netWorthCategory?.Name || "Uncategorized";
    const value = parseFloat(row.Value);
    const key = `${categoryName}-${account.IsAsset}`;

    if (!categories.has(key)) {
      categories.set(key, {
        category: categoryName,
        isAsset: account.IsAsset,
        totalValue: 0,
        items: [],
      });
    }

    const category = categories.get(key)!;
    category.items.push({
      accountId: account.AccountId,
      category: categoryName,
      name: account.Name,
      value,
      isAsset: account.IsAsset,
    });
    category.totalValue += value;

    if (account.IsAsset) {
      totalAssets += value;
    } else {
      totalLiabilities += value;
    }
  });

  return {
    snapshotId: snapshotData.SnapshotId,
    date: snapshotData.Date,
    notes: snapshotData.Notes,
    categories: Array.from(categories.values()),
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  };
};

// Create a new net worth snapshot with values
export const createNetWorthSnapshotNeon = async (
  accessToken: string,
  request: CreateNetWorthSnapshotRequest
): Promise<NetWorthSnapshot> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Step 1: Create snapshot
  const { data: snapshotData, error: snapshotError } = await pg
    .from("NetWorthSnapshots")
    .insert([
      {
        Date: request.date,
        Notes: request.notes || "",
        AccountId: request.accountId,
      },
    ])
    .select("SnapshotId, Date, Notes");

  if (snapshotError) {
    throw new Error(snapshotError.message || "Failed to create snapshot");
  }

  if (!snapshotData || snapshotData.length === 0) {
    throw new Error("Failed to create snapshot");
  }

  const snapshot = snapshotData[0];

  // Step 2: Create net worth entries
  if (request.accounts && request.accounts.length > 0) {
    const netWorthRows = request.accounts.map((account) => ({
      SnapshotId: snapshot.SnapshotId,
      NetWorthAccountId: account.accountId,
      Value: account.value,
      AccountId: request.accountId,
    }));

    const { error: insertError } = await pg
      .from("NetWorth")
      .insert(netWorthRows);

    if (insertError) {
      // Rollback the snapshot
      await pg
        .from("NetWorthSnapshots")
        .delete()
        .eq("SnapshotId", snapshot.SnapshotId);
      throw new Error(
        insertError.message || "Failed to create net worth entries"
      );
    }
  }

  return {
    snapshotId: snapshot.SnapshotId,
    date: snapshot.Date,
    notes: snapshot.Notes,
  };
};

// Delete a net worth snapshot (cascade deletes its net worth entries)
export const deleteNetWorthSnapshotNeon = async (
  accessToken: string,
  snapshotId: number
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { error } = await pg
    .from("NetWorthSnapshots")
    .delete()
    .eq("SnapshotId", snapshotId);

  if (error) {
    throw new Error(error.message || "Failed to delete net worth snapshot");
  }
};

// OPTIMIZED: Get all snapshots with calculated net worth in a single query
export const getNetWorthSnapshotsWithValuesNeon = async (
  accessToken: string,
  startDate?: string,
  endDate?: string
): Promise<(NetWorthSnapshot & { netWorth: number })[]> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Build snapshot query
  let snapshotQuery = pg
    .from("NetWorthSnapshots")
    .select("SnapshotId, Date, Notes");

  if (startDate) {
    snapshotQuery = snapshotQuery.gte("Date", startDate);
  }
  if (endDate) {
    snapshotQuery = snapshotQuery.lte("Date", endDate);
  }

  const { data: snapshots, error: snapshotError } = await snapshotQuery.order(
    "Date",
    { ascending: true }
  );

  if (snapshotError) {
    throw new Error(
      snapshotError.message || "Failed to fetch net worth snapshots"
    );
  }

  if (!snapshots || snapshots.length === 0) {
    return [];
  }

  // Get all net worth entries for these snapshots in one query
  const snapshotIds = snapshots.map((s: any) => s.SnapshotId);
  const { data: netWorthData, error: netWorthError } = await pg
    .from("NetWorth")
    .select(
      `
      SnapshotId,
      Value,
      NetWorthAccountId
    `
    )
    .in("SnapshotId", snapshotIds);

  if (netWorthError) {
    throw new Error(netWorthError.message || "Failed to fetch net worth data");
  }

  // Get all accounts to determine which are assets vs liabilities
  const { data: accountsData, error: accountsError } = await pg
    .from("NetWorthAccounts")
    .select("NetWorthAccountId, IsAsset");

  if (accountsError) {
    throw new Error(accountsError.message || "Failed to fetch accounts");
  }

  // Create a map of NetWorthAccountId to isAsset
  const accountMap = new Map<number, boolean>();
  (accountsData || []).forEach((account: any) => {
    accountMap.set(account.NetWorthAccountId, account.IsAsset);
  });

  // Calculate net worth for each snapshot
  const netWorthBySnapshot = new Map<number, number>();

  (netWorthData || []).forEach((row: any) => {
    const snapshotId = row.SnapshotId;
    const value = parseFloat(row.Value);

    // The values are stored as-is from the CSV:
    // - Assets are positive (e.g., Checking: 1715.22)
    // - Liabilities are ALREADY NEGATIVE in the database (e.g., Student Loans: -12256.65)
    // So we just sum all values directly without any transformation
    netWorthBySnapshot.set(
      snapshotId,
      (netWorthBySnapshot.get(snapshotId) || 0) + value
    );
  });

  // Combine snapshots with their calculated net worth
  return snapshots.map((snapshot: any) => ({
    snapshotId: snapshot.SnapshotId,
    date: snapshot.Date,
    notes: snapshot.Notes,
    netWorth: netWorthBySnapshot.get(snapshot.SnapshotId) || 0,
  }));
};

// Interface for account-level time series data
export interface SnapshotAccountValue {
  snapshotId: number;
  date: string;
  accountId: number;
  accountName: string;
  category: string;
  value: number;
  isAsset: boolean;
}

// Get snapshots with per-account values for filtering/charting
export const getNetWorthSnapshotsWithAccountValuesNeon = async (
  accessToken: string,
  startDate?: string,
  endDate?: string
): Promise<SnapshotAccountValue[]> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Build snapshot query
  let snapshotQuery = pg.from("NetWorthSnapshots").select("SnapshotId, Date");

  if (startDate) {
    snapshotQuery = snapshotQuery.gte("Date", startDate);
  }
  if (endDate) {
    snapshotQuery = snapshotQuery.lte("Date", endDate);
  }

  const { data: snapshots, error: snapshotError } = await snapshotQuery.order(
    "Date",
    { ascending: true }
  );

  if (snapshotError) {
    throw new Error(
      snapshotError.message || "Failed to fetch net worth snapshots"
    );
  }

  if (!snapshots || snapshots.length === 0) {
    return [];
  }

  // Get all net worth entries for these snapshots
  const snapshotIds = snapshots.map((s: any) => s.SnapshotId);
  const { data: netWorthData, error: netWorthError } = await pg
    .from("NetWorth")
    .select("SnapshotId, Value, NetWorthAccountId")
    .in("SnapshotId", snapshotIds);

  if (netWorthError) {
    throw new Error(netWorthError.message || "Failed to fetch net worth data");
  }

  // Get all accounts with their category info
  const { data: accountsData, error: accountsError } = await pg
    .from("NetWorthAccounts")
    .select("NetWorthAccountId, Name, IsAsset, NetWorthCategories(Name)");

  if (accountsError) {
    throw new Error(accountsError.message || "Failed to fetch accounts");
  }

  // Create maps for efficient lookups
  const snapshotDateMap = new Map<number, string>();
  snapshots.forEach((s: any) => {
    snapshotDateMap.set(s.SnapshotId, s.Date);
  });

  const accountInfoMap = new Map<
    number,
    { name: string; category: string; isAsset: boolean }
  >();
  (accountsData || []).forEach((account: any) => {
    accountInfoMap.set(account.NetWorthAccountId, {
      name: account.Name,
      category: account.NetWorthCategories?.Name || "Uncategorized",
      isAsset: account.IsAsset,
    });
  });

  // Build the result array
  return (netWorthData || []).map((row: any) => {
    const accountInfo = accountInfoMap.get(row.NetWorthAccountId) || {
      name: "Unknown",
      category: "Uncategorized",
      isAsset: true,
    };
    return {
      snapshotId: row.SnapshotId,
      date: snapshotDateMap.get(row.SnapshotId) || "",
      accountId: row.NetWorthAccountId,
      accountName: accountInfo.name,
      category: accountInfo.category,
      value: parseFloat(row.Value),
      isAsset: accountInfo.isAsset,
    };
  });
};

// OPTIMIZED: Get all unique accounts from all snapshots in one query
export const getAllNetWorthAccountTemplatesNeon = async (
  accessToken: string
): Promise<
  (Omit<CreateNetWorthAccountRequest, "accountId"> & {
    accountId?: number;
    isArchived?: boolean;
  })[]
> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { data, error } = await pg
    .from("NetWorthAccounts")
    .select(
      "NetWorthAccountId, Name, IsAsset, IsArchived, NetWorthCategories(Name)"
    )
    .order("Name");

  if (error) {
    throw new Error(error.message || "Failed to fetch account templates");
  }

  return (data || []).map((row: any) => ({
    accountId: row.NetWorthAccountId,
    name: row.Name,
    category: row.NetWorthCategories?.Name || "Uncategorized",
    isAsset: row.IsAsset,
    isArchived: row.IsArchived || false,
  }));
};

// Get all net worth accounts with IDs
export interface NetWorthAccountWithId extends CreateNetWorthAccountRequest {
  accountId: number;
  isArchived?: boolean;
}

export const getAllNetWorthAccountsNeon = async (
  accessToken: string
): Promise<NetWorthAccountWithId[]> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  let query = pg
    .from("NetWorthAccounts")
    .select(
      "NetWorthAccountId, Name, IsAsset, IsArchived, NetWorthCategories(Name)"
    )
    .order("Name");

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to fetch accounts");
  }

  return (data || []).map((row: any) => ({
    accountId: row.NetWorthAccountId,
    name: row.Name,
    category: row.NetWorthCategories?.Name || "Uncategorized",
    isAsset: row.IsAsset,
    isArchived: row.IsArchived || false,
  }));
};

// Create a new net worth account
export const createNetWorthAccountNeon = async (
  accessToken: string,
  request: CreateNetWorthAccountRequest
): Promise<NetWorthAccountWithId> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  // Look up the category ID by name and AccountId
  const { data: categoryData, error: categoryError } = await pg
    .from("NetWorthCategories")
    .select("CategoryId")
    .eq("Name", request.category)
    .eq("AccountId", request.accountId)
    .single();

  if (categoryError || !categoryData) {
    throw new Error(
      `Category "${request.category}" not found. Please create the category first.`
    );
  }

  const { data, error } = await pg
    .from("NetWorthAccounts")
    .insert([
      {
        Name: request.name,
        NetWorthCategoryId: categoryData.CategoryId,
        IsAsset: request.isAsset,
        Notes: request.notes || "",
        AccountId: request.accountId,
      },
    ])
    .select("NetWorthAccountId, Name, IsAsset, NetWorthCategories(Name)")
    .single();

  if (error) {
    throw new Error(error.message || "Failed to create account");
  }

  const netWorthCategory = Array.isArray(data.NetWorthCategories)
    ? data.NetWorthCategories[0]
    : data.NetWorthCategories;

  return {
    accountId: data.NetWorthAccountId,
    name: data.Name,
    category: netWorthCategory?.Name || request.category,
    isAsset: data.IsAsset,
  };
};

// Update an existing net worth account
export const updateNetWorthAccountNeon = async (
  accessToken: string,
  accountId: number,
  request: Partial<CreateNetWorthAccountRequest>
): Promise<NetWorthAccountWithId> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const updateData: any = {};
  if (request.name) updateData.Name = request.name;
  if (request.isAsset !== undefined) updateData.IsAsset = request.isAsset;
  if (request.notes) updateData.Notes = request.notes;

  // If category is being updated, look up the category ID
  if (request.category) {
    const { data: categoryData, error: categoryError } = await pg
      .from("NetWorthCategories")
      .select("CategoryId")
      .eq("Name", request.category)
      .single();

    if (categoryError || !categoryData) {
      throw new Error(
        `Category "${request.category}" not found. Please create the category first.`
      );
    }
    updateData.NetWorthCategoryId = categoryData.CategoryId;
  }

  const { data, error } = await pg
    .from("NetWorthAccounts")
    .update(updateData)
    .eq("NetWorthAccountId", accountId)
    .select(
      "NetWorthAccountId, Name, IsAsset, IsArchived, NetWorthCategories(Name)"
    )
    .single();

  if (error) {
    throw new Error(error.message || "Failed to update account");
  }

  const netWorthCategory = Array.isArray(data.NetWorthCategories)
    ? data.NetWorthCategories[0]
    : data.NetWorthCategories;

  return {
    accountId: data.NetWorthAccountId,
    name: data.Name,
    category: netWorthCategory?.Name || "Uncategorized",
    isAsset: data.IsAsset,
    isArchived: data.IsArchived || false,
  };
};

// Archive a net worth account (soft delete - hides from view but preserves data)
export const archiveNetWorthAccountNeon = async (
  accessToken: string,
  accountId: number
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { error } = await pg
    .from("NetWorthAccounts")
    .update({ IsArchived: true })
    .eq("NetWorthAccountId", accountId);

  if (error) {
    throw new Error(error.message || "Failed to archive account");
  }
};

// Unarchive a net worth account
export const unarchiveNetWorthAccountNeon = async (
  accessToken: string,
  accountId: number
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { error } = await pg
    .from("NetWorthAccounts")
    .update({ IsArchived: false })
    .eq("NetWorthAccountId", accountId);

  if (error) {
    throw new Error(error.message || "Failed to unarchive account");
  }
};

// Delete a net worth account (hard delete - removes all data)
export const deleteNetWorthAccountNeon = async (
  accessToken: string,
  accountId: number
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { error } = await pg
    .from("NetWorthAccounts")
    .delete()
    .eq("NetWorthAccountId", accountId);

  if (error) {
    throw new Error(error.message || "Failed to delete account");
  }
};

// Get account values over time (for filtering by account)
export interface AccountTimeSeries {
  date: string;
  value: number;
}

export const getAccountValuesOverTimeNeon = async (
  accessToken: string,
  accountId: number,
  startDate?: string,
  endDate?: string
): Promise<AccountTimeSeries[]> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  let query = pg
    .from("NetWorth")
    .select("NetWorthSnapshots(Date), Value")
    .eq("NetWorthAccountId", accountId);

  if (startDate) {
    query = query.gte("NetWorthSnapshots.Date", startDate);
  }
  if (endDate) {
    query = query.lte("NetWorthSnapshots.Date", endDate);
  }

  const { data, error } = await query.order("NetWorthSnapshots.Date", {
    ascending: true,
  });

  if (error) {
    throw new Error(
      error.message || "Failed to fetch account values over time"
    );
  }

  return (data || []).map((row: any) => ({
    date: row.NetWorthSnapshots.Date,
    value: parseFloat(row.Value),
  }));
};

// ========== NetWorth Categories CRUD Operations ==========

export interface NetWorthCategoryWithId {
  categoryId: number;
  name: string;
  isAsset: boolean;
  sortOrder: number;
  notes?: string;
  isArchived: boolean;
}

export interface CreateNetWorthCategoryRequest {
  name: string;
  isAsset: boolean;
  sortOrder?: number;
  notes?: string;
}

// Get all NetWorth categories
export const getAllNetWorthCategoriesNeon = async (
  accessToken: string
): Promise<NetWorthCategoryWithId[]> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { data, error } = await pg
    .from("NetWorthCategories")
    .select("CategoryId, Name, IsAsset, SortOrder, Notes")
    .order("SortOrder", { ascending: true })
    .order("Name", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to fetch categories");
  }

  return (data || []).map((row: any) => ({
    categoryId: row.CategoryId,
    name: row.Name,
    isAsset: row.IsAsset,
    sortOrder: row.SortOrder || 0,
    notes: row.Notes || "",
    isArchived: false,
  }));
};

// Create a new NetWorth category
export const createNetWorthCategoryNeon = async (
  accessToken: string,
  request: CreateNetWorthCategoryRequest
): Promise<NetWorthCategoryWithId> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { data, error } = await pg
    .from("NetWorthCategories")
    .insert([
      {
        Name: request.name,
        IsAsset: request.isAsset,
        SortOrder: request.sortOrder ?? 0,
        Notes: request.notes || "",
      },
    ])
    .select("CategoryId, Name, IsAsset, SortOrder, Notes")
    .single();

  if (error) {
    throw new Error(error.message || "Failed to create category");
  }

  return {
    categoryId: data.CategoryId,
    name: data.Name,
    isAsset: data.IsAsset,
    sortOrder: data.SortOrder || 0,
    notes: data.Notes || "",
    isArchived: false,
  };
};

// Update a NetWorth category
export const updateNetWorthCategoryNeon = async (
  accessToken: string,
  categoryId: number,
  request: Partial<CreateNetWorthCategoryRequest>
): Promise<NetWorthCategoryWithId> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const updateData: any = {};
  if (request.name) updateData.Name = request.name;
  if (request.isAsset !== undefined) updateData.IsAsset = request.isAsset;
  if (request.sortOrder !== undefined) updateData.SortOrder = request.sortOrder;
  if (request.notes !== undefined) updateData.Notes = request.notes;

  const { data, error } = await pg
    .from("NetWorthCategories")
    .update(updateData)
    .eq("CategoryId", categoryId)
    .select("CategoryId, Name, IsAsset, SortOrder, Notes")
    .single();

  if (error) {
    throw new Error(error.message || "Failed to update category");
  }

  return {
    categoryId: data.CategoryId,
    name: data.Name,
    isAsset: data.IsAsset,
    sortOrder: data.SortOrder || 0,
    notes: data.Notes || "",
    isArchived: false,
  };
};

// Archive a NetWorth category (soft delete)
export const archiveNetWorthCategoryNeon = async (
  accessToken: string,
  categoryId: number
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { error } = await pg
    .from("NetWorthCategories")
    .update({ IsArchived: true })
    .eq("CategoryId", categoryId);

  if (error) {
    throw new Error(error.message || "Failed to archive category");
  }
};

// Delete a NetWorth category (hard delete)
export const deleteNetWorthCategoryNeon = async (
  accessToken: string,
  categoryId: number
): Promise<void> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { error } = await pg
    .from("NetWorthCategories")
    .delete()
    .eq("CategoryId", categoryId);

  if (error) {
    throw new Error(error.message || "Failed to delete category");
  }
};
