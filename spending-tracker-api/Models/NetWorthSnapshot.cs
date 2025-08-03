namespace SpendingTrackerApi.Models;

public class NetWorthSnapshot
{
    public int SnapshotId { get; set; }
    public DateTime Date { get; set; }
    public decimal NetWorth { get; set; }
    public decimal? PercentageChange { get; set; }
    public decimal? DollarChange { get; set; }
    public string? Notes { get; set; }

    // Navigation property for assets and liabilities
    public ICollection<NetWorthAsset> Assets { get; set; } = new List<NetWorthAsset>();
}

public class NetWorthAsset
{
    public int AssetId { get; set; }
    public int SnapshotId { get; set; }
    public string Category { get; set; } = string.Empty; // "Bank Accounts", "Investments", "Credit Cards", "Debt", etc.
    public string Name { get; set; } = string.Empty; // "Checking", "Tesla", "Amazon Credit Card", etc.
    public decimal Value { get; set; }
    public bool IsAsset { get; set; } = true; // true for assets, false for liabilities

    // Navigation property
    public NetWorthSnapshot Snapshot { get; set; } = null!;
}
