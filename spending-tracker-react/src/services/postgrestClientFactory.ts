import { PostgrestClient } from "@supabase/postgrest-js";

/**
 * Factory for creating PostgrestClient instances with common configuration
 * including bearer token authentication and Neon branch headers
 */
export class PostgrestClientFactory {
  private static readonly DATA_API_URL = import.meta.env.VITE_DATA_API_URL;

  /**
   * Creates a configured PostgrestClient instance
   * @param accessToken - Bearer token for authentication
   * @returns Configured PostgrestClient instance
   * @throws Error if REACT_APP_DATA_API_URL is not set
   */
  static createClient(accessToken: string): PostgrestClient {
    if (!this.DATA_API_URL) {
      throw new Error("REACT_APP_DATA_API_URL environment variable is not set");
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    return new PostgrestClient(this.DATA_API_URL, { headers });
  }

  /**
   * Validates that the required environment variables are set
   * @throws Error if required environment variables are missing
   */
  static validateConfig(): void {
    if (!this.DATA_API_URL) {
      throw new Error("REACT_APP_DATA_API_URL environment variable is not set");
    }
  }

  /**
   * Gets the configured Data API URL
   * @returns The Data API URL or undefined if not set
   */
  static getDataApiUrl(): string | undefined {
    return this.DATA_API_URL;
  }
}
