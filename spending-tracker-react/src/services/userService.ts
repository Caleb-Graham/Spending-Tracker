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
    // Try the API endpoint first (works in production)
    const response = await fetch(`/api/users/${encodeURIComponent(userId)}`);

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      // If we got HTML or 404, the API route doesn't exist (local dev)
      if (response.status === 404 || contentType?.includes("text/html")) {
        // Fallback to direct Stack Auth API call (dev only)
        return await fetchUserInfoDirect(userId);
      }
      console.error(`Failed to fetch user info: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      // Got HTML instead of JSON - API route not available, use fallback
      return await fetchUserInfoDirect(userId);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching user info:", error);
    // Try the fallback
    return await fetchUserInfoDirect(userId);
  }
}

// Direct Stack Auth API call for local development
async function fetchUserInfoDirect(userId: string): Promise<UserInfo | null> {
  const projectId = import.meta.env.VITE_STACK_PROJECT_ID;
  const secretKey = import.meta.env.VITE_STACK_SECRET_KEY;

  if (!projectId || !secretKey) {
    console.warn(
      "[UserService] Stack Auth credentials not available for user lookup"
    );
    return null;
  }

  try {
    const response = await fetch(
      `https://api.stack-auth.com/api/v1/users/${encodeURIComponent(userId)}`,
      {
        method: "GET",
        headers: {
          "x-stack-project-id": projectId,
          "x-stack-secret-server-key": secretKey,
          "x-stack-access-type": "server",
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorText = await response.text();
      console.error(
        `[UserService] Stack Auth API error: ${response.status}`,
        errorText
      );
      return null;
    }

    const user = await response.json();
    return {
      id: user.id,
      displayName:
        user.display_name || user.primary_email?.split("@")[0] || null,
      profileImageUrl: user.profile_image_url || null,
    };
  } catch (error) {
    console.error("Error fetching user from Stack Auth:", error);
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
