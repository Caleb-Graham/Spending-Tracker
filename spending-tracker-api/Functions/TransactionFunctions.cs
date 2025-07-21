using SpendingTrackerApi.Methods;

namespace SpendingTrackerApi.Functions;

public static class TransactionFunctions
{
    public static void MapTransactionFunctions(this WebApplication app)
    {
        var group = app.MapGroup("/api/transactions")
            .WithTags("Transactions");

        group.MapGet("", GetTransactions);
        group.MapPost("/upload", UploadTransactions);
    }

    private static async Task<IResult> GetTransactions(TransactionMethods transactionMethods)
    {
        try
        {
            var transactions = await transactionMethods.GetTransactionsAsync();
            return Results.Ok(new { data = transactions });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }

    private static async Task<IResult> UploadTransactions(HttpRequest request, TransactionMethods transactionMethods)
    {
        try
        {
            if (!request.HasFormContentType || request.Form.Files.Count == 0)
            {
                return Results.BadRequest(new { error = new { message = "No file uploaded" } });
            }

            var file = request.Form.Files[0];
            if (file.Length == 0)
            {
                return Results.BadRequest(new { error = new { message = "Empty file" } });
            }

            using var stream = file.OpenReadStream();
            var result = await transactionMethods.ImportTransactionsFromCsv(stream);

            var message = $"Import completed. {result.NewTransactions} new transactions added";
            if (result.DuplicatesSkipped > 0)
            {
                message += $", {result.DuplicatesSkipped} duplicates skipped";
            }
            message += $" (out of {result.TotalRecords} total records)";

            return Results.Ok(new
            {
                message = message,
                details = result
            });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }
}
