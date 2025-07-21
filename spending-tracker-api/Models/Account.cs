namespace SpendingTrackerApi.Models;

public class Account
{
    public int AccountId { get; set; }
    public string Name { get; set; } = string.Empty;
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
}
