import { afterEach, describe, expect, it, vi } from "vitest";
import { PostgrestClientFactory } from "../services/postgrestClientFactory";
import { findUserAccountId, getUserAccountId } from "./accountUtils";

const mockAccountLookup = (result: {
  data: { AccountId: number } | null;
  error: { message: string } | null;
}) => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.limit.mockReturnValue(query);

  vi.spyOn(PostgrestClientFactory, "createClient").mockReturnValue({
    from: vi.fn().mockReturnValue(query),
  } as never);
};

describe("accountUtils", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when the user has no active account", async () => {
    mockAccountLookup({ data: null, error: null });

    await expect(findUserAccountId("token")).resolves.toBeNull();
  });

  it("returns the active account ID when one exists", async () => {
    mockAccountLookup({ data: { AccountId: 42 }, error: null });

    await expect(findUserAccountId("token")).resolves.toBe(42);
  });

  it("still reports actual account lookup failures", async () => {
    mockAccountLookup({ data: null, error: { message: "Database unavailable" } });

    await expect(findUserAccountId("token")).rejects.toThrow("Database unavailable");
  });

  it("requires an account for operations that write account-owned data", async () => {
    mockAccountLookup({ data: null, error: null });

    await expect(getUserAccountId("token")).rejects.toThrow(
      "No active user account found",
    );
  });
});
