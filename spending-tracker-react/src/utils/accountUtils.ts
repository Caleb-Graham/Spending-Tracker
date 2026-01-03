import { PostgrestClientFactory } from "../services/postgrestClientFactory";

/**
 * Get the current user's account ID from the AccountMembers table.
 * This is used to associate data with the user's shared account.
 */
export const getUserAccountId = async (
  accessToken: string
): Promise<number> => {
  const pg = PostgrestClientFactory.createClient(accessToken);

  const { data, error } = await pg
    .from("AccountMembers")
    .select("AccountId")
    .eq("Status", "active")
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error("Failed to get user account");
  }

  return data.AccountId;
};
