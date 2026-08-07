import { PostgrestClientFactory } from "../services/postgrestClientFactory";

/**
 * Find the current user's account ID from the AccountMembers table.
 * A user without an active account is a valid empty state.
 */
export const findUserAccountId = async (
  accessToken: string
): Promise<number | null> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { data, error } = await pg
    .from("AccountMembers")
    .select("AccountId")
    .eq("Status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to get user account");
  }

  return data?.AccountId ?? null;
};

/**
 * Get the current user's account ID when an account is required for a write.
 */
export const getUserAccountId = async (
  accessToken: string
): Promise<number> => {
  const accountId = await findUserAccountId(accessToken);

  if (accountId === null) {
    throw new Error("No active user account found");
  }

  return accountId;
};
