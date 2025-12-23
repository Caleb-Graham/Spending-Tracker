import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Client } from "pg";

// Manual trigger endpoint for testing recurring transactions
// This is identical to the cron job but doesn't require authorization
// REMOVE THIS IN PRODUCTION or add your own auth
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  console.log(
    `[MANUAL] Starting recurring transaction processing at ${new Date().toISOString()}`
  );

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
    console.log("[MANUAL] Connected to database");

    // 1. Fetch all active recurring transactions where NextRunAt <= now
    const { rows: recurringTransactions } = await client.query(
      `SELECT * FROM "RecurringTransactions" WHERE "IsActive" = true AND "NextRunAt" <= NOW()`
    );

    console.log(
      `[MANUAL] Found ${recurringTransactions.length} recurring transactions to process`
    );

    let processed = 0;
    let errors = 0;
    const details: any[] = [];

    // 2. Process each recurring transaction
    for (const rt of recurringTransactions) {
      try {
        console.log(
          `[MANUAL] Processing transaction: ${JSON.stringify(rt, null, 2)}`
        );

        // Start a transaction
        await client.query("BEGIN");

        // Set JWT claims so jwt_uid() default works
        await client.query(
          `SET LOCAL "request.jwt.claims" = '{"sub":"${rt.UserId}"}'`
        );

        // Create the actual transaction
        const { rows: created } = await client.query(
          `INSERT INTO "Transactions" ("Date", "Note", "Amount", "CategoryId", "RecurringTransactionId") 
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            rt.NextRunAt,
            rt.Note,
            rt.Amount,
            rt.CategoryId,
            rt.RecurringTransactionId,
          ]
        );

        console.log(
          `[MANUAL] Created transaction: ${JSON.stringify(created[0], null, 2)}`
        );

        // Calculate the next run date
        const nextRunAt = calculateNextRunAt(
          rt.NextRunAt,
          rt.Frequency,
          rt.Interval
        );

        console.log(`[MANUAL] Next run at: ${nextRunAt.toISOString()}`);

        // Update the recurring transaction
        await client.query(
          `UPDATE "RecurringTransactions" 
           SET "NextRunAt" = $1, "LastRunAt" = $2, "UpdatedAt" = NOW()
           WHERE "RecurringTransactionId" = $3`,
          [nextRunAt, rt.NextRunAt, rt.RecurringTransactionId]
        );

        // Commit the transaction
        await client.query("COMMIT");

        processed++;
        details.push({
          id: rt.RecurringTransactionId,
          note: rt.Note,
          amount: rt.Amount,
          nextRunAt: nextRunAt.toISOString(),
          status: "success",
          createdTransaction: created[0],
        });

        console.log(
          `[MANUAL] Successfully processed recurring transaction ${rt.RecurringTransactionId}`
        );
      } catch (err) {
        await client.query("ROLLBACK");
        errors++;
        details.push({
          id: rt.RecurringTransactionId,
          note: rt.Note,
          amount: rt.Amount,
          status: "error",
          error: String(err),
        });
        console.error(
          `[MANUAL] Error processing recurring transaction ${rt.RecurringTransactionId}:`,
          err
        );
      }
    }

    return res.status(200).json({
      success: true,
      processed,
      errors,
      total: recurringTransactions.length,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      details,
    });
  } catch (error) {
    console.error("[MANUAL] Processing failed:", error);
    return res.status(500).json({
      error: "Processing failed",
      details: String(error),
      timestamp: new Date().toISOString(),
    });
  } finally {
    await client.end();
  }
}

function calculateNextRunAt(
  currentNextRunAt: Date,
  frequency: string,
  interval: number
): Date {
  const date = new Date(currentNextRunAt);

  switch (frequency) {
    case "DAILY":
      date.setDate(date.getDate() + interval);
      break;
    case "WEEKLY":
      date.setDate(date.getDate() + 7 * interval);
      break;
    case "MONTHLY":
      date.setMonth(date.getMonth() + interval);
      break;
    case "YEARLY":
      date.setFullYear(date.getFullYear() + interval);
      break;
  }

  return date;
}

export const config = {
  runtime: "nodejs",
};
