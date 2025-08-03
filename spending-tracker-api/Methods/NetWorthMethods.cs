using Microsoft.EntityFrameworkCore;
using SpendingTrackerApi.Data;
using SpendingTrackerApi.Models;

namespace SpendingTrackerApi.Methods;

public class NetWorthMethods
{
    private readonly SpendingDbContext _context;

    public NetWorthMethods(SpendingDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<NetWorthSnapshotDto>> GetNetWorthSnapshotsAsync(DateTime? startDate = null, DateTime? endDate = null)
    {
        try
        {
            var query = _context.NetWorthSnapshots.AsQueryable();

            // Filter by date range if provided
            if (startDate.HasValue)
            {
                query = query.Where(s => s.Date >= startDate.Value);
            }
            if (endDate.HasValue)
            {
                query = query.Where(s => s.Date <= endDate.Value);
            }

            return await query
                .OrderBy(s => s.Date)
                .Select(s => new NetWorthSnapshotDto
                {
                    SnapshotId = s.SnapshotId,
                    Date = s.Date,
                    NetWorth = s.NetWorth,
                    PercentageChange = s.PercentageChange,
                    DollarChange = s.DollarChange,
                    Notes = s.Notes
                })
                .ToListAsync();
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to fetch net worth snapshots: {ex.Message}");
        }
    }

    public async Task<NetWorthDetailDto?> GetNetWorthDetailAsync(int snapshotId)
    {
        try
        {
            var snapshot = await _context.NetWorthSnapshots
                .Include(s => s.Assets)
                .FirstOrDefaultAsync(s => s.SnapshotId == snapshotId);

            if (snapshot == null)
            {
                return null;
            }

            return new NetWorthDetailDto
            {
                SnapshotId = snapshot.SnapshotId,
                Date = snapshot.Date,
                NetWorth = snapshot.NetWorth,
                PercentageChange = snapshot.PercentageChange,
                DollarChange = snapshot.DollarChange,
                Notes = snapshot.Notes,
                Assets = snapshot.Assets.Select(a => new NetWorthAssetDto
                {
                    AssetId = a.AssetId,
                    Category = a.Category,
                    Name = a.Name,
                    Value = a.Value,
                    IsAsset = a.IsAsset
                }).ToList()
            };
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to fetch net worth detail: {ex.Message}");
        }
    }

    public async Task<NetWorthCategorySummaryDto> GetNetWorthCategorySummaryAsync(int snapshotId)
    {
        try
        {
            var snapshot = await _context.NetWorthSnapshots
                .Include(s => s.Assets)
                .FirstOrDefaultAsync(s => s.SnapshotId == snapshotId);

            if (snapshot == null)
            {
                throw new Exception("Net worth snapshot not found");
            }

            var categoryTotals = snapshot.Assets
                .GroupBy(a => new { a.Category, a.IsAsset })
                .Select(g => new NetWorthCategoryDto
                {
                    Category = g.Key.Category,
                    IsAsset = g.Key.IsAsset,
                    TotalValue = g.Sum(a => a.Value),
                    Items = g.Select(a => new NetWorthAssetDto
                    {
                        AssetId = a.AssetId,
                        Category = a.Category,
                        Name = a.Name,
                        Value = a.Value,
                        IsAsset = a.IsAsset
                    }).OrderByDescending(a => Math.Abs(a.Value)).ToList()
                })
                .OrderByDescending(c => c.IsAsset)
                .ThenByDescending(c => Math.Abs(c.TotalValue))
                .ToList();

            return new NetWorthCategorySummaryDto
            {
                SnapshotId = snapshot.SnapshotId,
                Date = snapshot.Date,
                NetWorth = snapshot.NetWorth,
                Categories = categoryTotals
            };
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to fetch net worth category summary: {ex.Message}");
        }
    }

    public async Task<NetWorthSnapshotDto> CreateNetWorthSnapshotAsync(CreateNetWorthSnapshotRequest request)
    {
        try
        {
            // Check if a snapshot already exists for this date
            var existingSnapshot = await _context.NetWorthSnapshots
                .FirstOrDefaultAsync(s => s.Date.Date == request.Date.Date);

            if (existingSnapshot != null)
            {
                throw new Exception($"A net worth snapshot already exists for {request.Date:yyyy-MM-dd}");
            }

            var snapshot = new NetWorthSnapshot
            {
                Date = request.Date,
                NetWorth = request.NetWorth,
                PercentageChange = request.PercentageChange,
                DollarChange = request.DollarChange,
                Notes = request.Notes
            };

            _context.NetWorthSnapshots.Add(snapshot);
            await _context.SaveChangesAsync();

            // Add assets
            foreach (var asset in request.Assets)
            {
                var netWorthAsset = new NetWorthAsset
                {
                    SnapshotId = snapshot.SnapshotId,
                    Category = asset.Category,
                    Name = asset.Name,
                    Value = asset.Value,
                    IsAsset = asset.IsAsset
                };
                _context.NetWorthAssets.Add(netWorthAsset);
            }

            await _context.SaveChangesAsync();

            return new NetWorthSnapshotDto
            {
                SnapshotId = snapshot.SnapshotId,
                Date = snapshot.Date,
                NetWorth = snapshot.NetWorth,
                PercentageChange = snapshot.PercentageChange,
                DollarChange = snapshot.DollarChange,
                Notes = snapshot.Notes
            };
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to create net worth snapshot: {ex.Message}");
        }
    }

    public async Task<bool> DeleteNetWorthSnapshotAsync(int snapshotId)
    {
        try
        {
            var snapshot = await _context.NetWorthSnapshots
                .Include(s => s.Assets)
                .FirstOrDefaultAsync(s => s.SnapshotId == snapshotId);

            if (snapshot == null)
            {
                return false;
            }

            _context.NetWorthSnapshots.Remove(snapshot);
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to delete net worth snapshot: {ex.Message}");
        }
    }
}

// DTOs for NetWorth management
public class NetWorthSnapshotDto
{
    public int SnapshotId { get; set; }
    public DateTime Date { get; set; }
    public decimal NetWorth { get; set; }
    public decimal? PercentageChange { get; set; }
    public decimal? DollarChange { get; set; }
    public string? Notes { get; set; }
}

public class NetWorthDetailDto : NetWorthSnapshotDto
{
    public List<NetWorthAssetDto> Assets { get; set; } = new List<NetWorthAssetDto>();
}

public class NetWorthAssetDto
{
    public int AssetId { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Value { get; set; }
    public bool IsAsset { get; set; }
}

public class NetWorthCategorySummaryDto
{
    public int SnapshotId { get; set; }
    public DateTime Date { get; set; }
    public decimal NetWorth { get; set; }
    public List<NetWorthCategoryDto> Categories { get; set; } = new List<NetWorthCategoryDto>();
}

public class NetWorthCategoryDto
{
    public string Category { get; set; } = string.Empty;
    public bool IsAsset { get; set; }
    public decimal TotalValue { get; set; }
    public List<NetWorthAssetDto> Items { get; set; } = new List<NetWorthAssetDto>();
}

public class CreateNetWorthSnapshotRequest
{
    public DateTime Date { get; set; }
    public decimal NetWorth { get; set; }
    public decimal? PercentageChange { get; set; }
    public decimal? DollarChange { get; set; }
    public string? Notes { get; set; }
    public List<CreateNetWorthAssetRequest> Assets { get; set; } = new List<CreateNetWorthAssetRequest>();
}

public class CreateNetWorthAssetRequest
{
    public string Category { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Value { get; set; }
    public bool IsAsset { get; set; }
}
