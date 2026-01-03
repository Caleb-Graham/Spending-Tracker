import { StackClientApp, useUser } from "@stackframe/react";
import { useNavigate } from "react-router-dom";

// Stack Auth client
export const stackApp = new StackClientApp({
  projectId: import.meta.env.VITE_STACK_PROJECT_ID,
  publishableClientKey: import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY,
  tokenStore: "cookie",
  redirectMethod: { useNavigate },
});

// Auth hook for components
export function useAuth() {
  const user = useUser();

  return {
    user,
    isPending: user === undefined,
    isAuthenticated: !!user,
    signOut: () => user?.signOut(),
    getAccessToken: async (): Promise<string | null> => {
      if (!user) return null;
      try {
        return (await user.getAuthJson()).accessToken;
      } catch (error) {
        console.error("Failed to get auth token:", error);
        return null;
      }
    },
  };
}
