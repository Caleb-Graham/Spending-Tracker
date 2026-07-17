/// <reference types="node" />
import type { VercelRequest, VercelResponse } from "@vercel/node";

// API endpoint to look up user info by userId
// Returns displayName and profileImageUrl for displaying who added a transaction
// Uses the Hexclave REST API: https://docs.hexclave.com/api/overview

const HEXCLAVE_API_URL = "https://api.hexclave.com/api/v1";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId parameter" });
  }

  const projectId = process.env.VITE_HEXCLAVE_PROJECT_ID;
  const secretKey = process.env.HEXCLAVE_SECRET_KEY;

  if (!projectId || !secretKey) {
    console.error("[API] Missing Hexclave configuration");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    // Call the Hexclave REST API to get user by ID
    const response = await fetch(
      `${HEXCLAVE_API_URL}/users/${encodeURIComponent(userId)}`,
      {
        method: "GET",
        headers: {
          "x-hexclave-project-id": projectId,
          "x-hexclave-secret-server-key": secretKey,
          "x-hexclave-access-type": "server",
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: "User not found" });
      }
      console.error(`[API] Hexclave API error: ${response.status}`);
      return res.status(500).json({ error: "Failed to fetch user info" });
    }

    const user = await response.json();

    // Return only safe, public user info
    return res.status(200).json({
      id: user.id,
      displayName:
        user.display_name || user.primary_email?.split("@")[0] || null,
      profileImageUrl: user.profile_image_url || null,
    });
  } catch (error) {
    console.error("[API] Error fetching user:", error);
    return res.status(500).json({ error: "Failed to fetch user info" });
  }
}
