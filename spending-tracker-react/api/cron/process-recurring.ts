import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Client } from "pg";

// This cron job processes recurring transactions
// It runs daily at 6 AM UTC and creates transactions for any recurring transactions
// where NextRunAt <= now()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify the request is from Vercel Cron (security)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    return res
      .status(500)
      .json({ error: "Missing DATABASE_URL environment variable" });
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Required for Neon
  });

  try {
    await client.connect();
    console.log("Connected to database");

    // 1. Fetch all active recurring transactions where NextRunAt <= now
    const { rows: recurringTransactions } = await client.query(
      `SELECT * FROM "RecurringTransactions" WHERE "IsActive" = true AND "NextRunAt" <= NOW()`
    );

    console.log(
      `Found ${recurringTransactions.length} recurring transactions to process`
    );

    let processed = 0;
    let errors = 0;

    // 2. Process each recurring transaction
    for (const rt of recurringTransactions) {
      try {
        // Start a transaction
        await client.query("BEGIN");

        // Set JWT claims so jwt_uid() default works
        await client.query(
          `SET LOCAL "request.jwt.claims" = '{"sub":"${rt.UserId}"}'`
        );

        // Create the actual transaction (UserId will use DEFAULT jwt_uid())
        await client.query(
          `INSERT INTO "Transactions" ("Date", "Note", "Amount", "CategoryId", "RecurringTransactionId") 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            rt.NextRunAt,
            rt.Note,
            rt.Amount,
            rt.CategoryId,
            rt.RecurringTransactionId,
          ]
        );

        // Calculate the next run date
        const nextRunAt = calculateNextRunAt(
          rt.NextRunAt,
          rt.Frequency,
          rt.Interval
        );

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
        console.log(
          `Processed recurring transaction ${rt.RecurringTransactionId}`
        );
      } catch (err) {
        await client.query("ROLLBACK");
        errors++;
        console.error(
          `Error processing recurring transaction ${rt.RecurringTransactionId}:`,
          err
        );
      }
    }

    return res.status(200).json({
      success: true,
      processed,
      errors,
      total: recurringTransactions.length,
    });
  } catch (error) {
    console.error("Cron job failed:", error);
    return res
      .status(500)
      .json({ error: "Cron job failed", details: String(error) });
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
