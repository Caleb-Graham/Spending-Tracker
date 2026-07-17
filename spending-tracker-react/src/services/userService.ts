// User lookup service with caching
// Fetches user info from the /api/users/[userId] endpoint

export interface UserInfo {
  id: string;
  displayName: string | null;
  profileImageUrl: string | null;
}

// Cache user info with 10 minute expiry
const userCache = new Map<string, { user: UserInfo; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Track in-flight requests to avoid duplicate calls
const pendingRequests = new Map<string, Promise<UserInfo | null>>();

export async function getUserInfo(userId: string): Promise<UserInfo | null> {
  // Check cache first
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.user;
  }

  // Check if there's already a request in flight for this user
  const pending = pendingRequests.get(userId);
  if (pending) {
    return pending;
  }

  // Make the request
  const requestPromise = fetchUserInfo(userId);
  pendingRequests.set(userId, requestPromise);

  try {
    const user = await requestPromise;
    if (user) {
      userCache.set(userId, { user, timestamp: Date.now() });
    }
    return user;
  } finally {
    pendingRequests.delete(userId);
  }
}

async function fetchUserInfo(userId: string): Promise<UserInfo | null> {
  try {
    const response = await fetch(`/api/users/${encodeURIComponent(userId)}`);

    if (!response.ok) {
      console.error(`Failed to fetch user info: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      console.error(
        "[UserService] User API returned a non-JSON response. Run local development through `vercel dev` so serverless API routes are available."
      );
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching user info:", error);
    return null;
  }
}

// Batch fetch multiple users at once (useful for loading a page of transactions)
export async function getUserInfoBatch(
  userIds: string[]
): Promise<Map<string, UserInfo | null>> {
  const uniqueIds = [...new Set(userIds)];
  const results = new Map<string, UserInfo | null>();

  await Promise.all(
    uniqueIds.map(async (userId) => {
      const user = await getUserInfo(userId);
      results.set(userId, user);
    })
  );

  return results;
}

// Clear cache (useful after logout)
export function clearUserCache(): void {
  userCache.clear();
  pendingRequests.clear();
}
