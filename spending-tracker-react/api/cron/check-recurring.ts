import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Client } from "pg";

// Diagnostic endpoint to check recurring transactions status
// Call this manually to see what's pending
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("[CHECK] Starting diagnostic check");
  
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error("[CHECK] Missing DATABASE_URL");
    return res
      .status(500)
      .json({ error: "Missing DATABASE_URL environment variable" });
  }

  let client: Client | null = null;

  try {
    console.log("[CHECK] Creating database client");
    client = new Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    console.log("[CHECK] Connecting to database");
    await client.connect();
    console.log("[CHECK] Connected successfully");

    // Get all recurring transactions
    console.log("[CHECK] Fetching all recurring transactions");
    const { rows: allRecurring } = await client.query(
      `SELECT 
        "RecurringTransactionId",
        "UserId",
        "Note",
        "Amount",
        "Frequency",
        "Interval",
        "NextRunAt",
        "LastRunAt",
        "IsActive",
        "CreatedAt"
       FROM "RecurringTransactions" 
       ORDER BY "NextRunAt" ASC`
    );
    console.log(`[CHECK] Found ${allRecurring.length} recurring transactions`);

    // Get pending ones (NextRunAt <= now)
    console.log("[CHECK] Fetching pending recurring transactions");
    const { rows: pending } = await client.query(
      `SELECT 
        "RecurringTransactionId",
        "UserId",
        "Note",
        "Amount",
        "Frequency",
        "Interval",
        "NextRunAt",
        "LastRunAt",
        "IsActive"
       FROM "RecurringTransactions" 
       WHERE "IsActive" = true AND "NextRunAt" <= NOW()
       ORDER BY "NextRunAt" ASC`
    );
    console.log(`[CHECK] Found ${pending.length} pending transactions`);

    // Get last 10 cron-created transactions
    console.log("[CHECK] Fetching recent transactions");
    const { rows: recentTransactions } = await client.query(
      `SELECT 
        t."TransactionId",
        t."Date",
        t."Note",
        t."Amount",
        t."RecurringTransactionId",
        t."CreatedAt"
       FROM "Transactions" t
       WHERE t."RecurringTransactionId" IS NOT NULL
       ORDER BY t."CreatedAt" DESC
       LIMIT 10`
    );
    console.log(`[CHECK] Found ${recentTransactions.length} recent transactions`);

    const response = {
      success: true,
      currentTime: new Date().toISOString(),
      summary: {
        totalRecurring: allRecurring.length,
        activeRecurring: allRecurring.filter((r) => r.IsActive).length,
        pendingToProcess: pending.length,
        recentTransactionsCreated: recentTransactions.length,
      },
      allRecurringTransactions: allRecurring,
      pendingRecurringTransactions: pending,
      recentlyCreatedTransactions: recentTransactions,
    };

    console.log("[CHECK] Returning response");
    return res.status(200).json(response);
  } catch (error) {
    console.error("[CHECK] Error occurred:", error);
    console.error("[CHECK] Error stack:", error instanceof Error ? error.stack : "N/A");
    return res
      .status(500)
      .json({ 
        error: "Diagnostic failed", 
        details: String(error),
        message: error instanceof Error ? error.message : "Unknown error"
      });
  } finally {
    if (client) {
      console.log("[CHECK] Closing database connection");
      await client.end();
    }
  }
}

export const config = {
  runtime: "nodejs",
};
