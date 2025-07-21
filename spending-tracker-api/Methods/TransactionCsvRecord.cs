namespace SpendingTrackerApi.Methods;

public class TransactionCsvRecord
{
    public DateTime Date { get; set; }
    public string Category { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? Note { get; set; }
    public string Account { get; set; } = string.Empty;
}
