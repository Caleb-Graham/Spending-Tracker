namespace SpendingTrackerApi.Models;

public class Transaction
{
    public int TransactionId { get; set; }
    public DateTime Date { get; set; }
    public decimal Amount { get; set; }
    public string Note { get; set; } = string.Empty;

    // Foreign keys
    public int CategoryId { get; set; }
    public int AccountId { get; set; }

    // Navigation properties
    public Category Category { get; set; } = null!;
    public Account Account { get; set; } = null!;

    // Helper property to determine if it's income or expense
    public bool IsIncome => Amount > 0;
}