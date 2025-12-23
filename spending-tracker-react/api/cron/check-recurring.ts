import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Client } from "pg";

// Diagnostic endpoint to check recurring transactions status
// Call this manually to see what's pending
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    return res
      .status(500)
      .json({ error: "Missing DATABASE_URL environment variable" });
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    // Get all recurring transactions
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

    // Get pending ones (NextRunAt <= now)
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

    // Get last 10 cron-created transactions
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

    return res.status(200).json({
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
    });
  } catch (error) {
    console.error("Diagnostic check failed:", error);
    return res
      .status(500)
      .json({ error: "Diagnostic failed", details: String(error) });
  } finally {
    await client.end();
  }
}

export const config = {
  runtime: "nodejs",
};
