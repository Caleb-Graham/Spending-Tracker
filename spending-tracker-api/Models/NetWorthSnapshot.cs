namespace SpendingTrackerApi.Models;

public class NetWorth
{
    public int Id { get; set; }
    public DateTime Date { get; set; }
    public decimal NetWorthTotal { get; set; }
    public string? Notes { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public string AccountCategory { get; set; } = string.Empty;
    public decimal AccountValue { get; set; }
    public bool IsAsset { get; set; } = true;
}
