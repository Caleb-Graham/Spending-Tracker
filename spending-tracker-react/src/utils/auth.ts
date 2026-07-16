import { HexclaveClientApp, useUser } from "@hexclave/react";
import { useNavigate } from "react-router-dom";

// Hexclave client
export const hexclaveApp = new HexclaveClientApp({
  projectId: import.meta.env.VITE_HEXCLAVE_PROJECT_ID,
  publishableClientKey: import.meta.env.VITE_HEXCLAVE_PUBLISHABLE_CLIENT_KEY,
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
