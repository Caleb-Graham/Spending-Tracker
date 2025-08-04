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
            var query = _context.NetWorth.AsQueryable();

            // Filter by date range if provided
            if (startDate.HasValue)
            {
                query = query.Where(s => s.Date >= startDate.Value);
            }
            if (endDate.HasValue)
            {
                query = query.Where(s => s.Date <= endDate.Value);
            }

            // Get all records and process in memory
            var allRecords = await query.ToListAsync();

            // Group by date and get one representative record per date
            var snapshots = allRecords
                .GroupBy(n => n.Date)
                .Select(g => g.OrderBy(n => n.Id).First())
                .OrderBy(s => s.Date)
                .ToList();

            return snapshots.Select(s => new NetWorthSnapshotDto
            {
                SnapshotId = s.Id,
                Date = s.Date,
                NetWorth = s.NetWorthTotal,
                PercentageChange = null, // Calculate in frontend
                DollarChange = null, // Calculate in frontend
                Notes = s.Notes
            });
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
            // Find the date for this snapshot ID
            var snapshotRecord = await _context.NetWorth
                .FirstOrDefaultAsync(n => n.Id == snapshotId);

            if (snapshotRecord == null)
            {
                return null;
            }

            // Get all records for this date (compare date part only)
            var allRecords = await _context.NetWorth
                .Where(n => n.Date.Date == snapshotRecord.Date.Date)
                .ToListAsync();

            return new NetWorthDetailDto
            {
                SnapshotId = snapshotRecord.Id,
                Date = snapshotRecord.Date,
                NetWorth = snapshotRecord.NetWorthTotal,
                PercentageChange = null,
                DollarChange = null,
                Notes = snapshotRecord.Notes,
                Assets = allRecords.Select(r => new NetWorthAssetDto
                {
                    AssetId = r.Id,
                    Category = r.AccountCategory,
                    Name = r.AccountName,
                    Value = r.AccountValue,
                    IsAsset = r.IsAsset
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
            // Find the date for this snapshot ID
            var snapshotRecord = await _context.NetWorth
                .FirstOrDefaultAsync(n => n.Id == snapshotId);

            if (snapshotRecord == null)
            {
                throw new Exception("Net worth snapshot not found");
            }

            // Get all records for this date (compare date part only)
            var allRecords = await _context.NetWorth
                .Where(n => n.Date.Date == snapshotRecord.Date.Date)
                .ToListAsync();

            var categoryTotals = allRecords
                .GroupBy(r => new { r.AccountCategory, r.IsAsset })
                .Select(g => new NetWorthCategoryDto
                {
                    Category = g.Key.AccountCategory,
                    IsAsset = g.Key.IsAsset,
                    TotalValue = g.Sum(r => r.AccountValue),
                    Items = g.Select(r => new NetWorthAssetDto
                    {
                        AssetId = r.Id,
                        Category = r.AccountCategory,
                        Name = r.AccountName,
                        Value = r.AccountValue,
                        IsAsset = r.IsAsset
                    }).OrderByDescending(a => Math.Abs(a.Value)).ToList()
                })
                .OrderByDescending(c => c.IsAsset)
                .ThenByDescending(c => Math.Abs(c.TotalValue))
                .ToList();

            return new NetWorthCategorySummaryDto
            {
                SnapshotId = snapshotRecord.Id,
                Date = snapshotRecord.Date,
                NetWorth = snapshotRecord.NetWorthTotal,
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
            var existingRecords = await _context.NetWorth
                .Where(n => n.Date.Date == request.Date.Date)
                .ToListAsync();

            if (existingRecords.Any())
            {
                throw new Exception($"A net worth snapshot already exists for {request.Date:yyyy-MM-dd}");
            }

            var newRecords = new List<NetWorth>();
            int firstId = 0;

            // Create a record for each asset
            foreach (var asset in request.Assets)
            {
                var record = new NetWorth
                {
                    Date = request.Date,
                    NetWorthTotal = request.NetWorth,
                    Notes = request.Notes,
                    AccountName = asset.Name,
                    AccountCategory = asset.Category,
                    AccountValue = asset.Value,
                    IsAsset = asset.IsAsset
                };

                _context.NetWorth.Add(record);
                newRecords.Add(record);
            }

            await _context.SaveChangesAsync();

            // Return the first record's ID as the snapshot ID
            firstId = newRecords.First().Id;

            return new NetWorthSnapshotDto
            {
                SnapshotId = firstId,
                Date = request.Date,
                NetWorth = request.NetWorth,
                PercentageChange = request.PercentageChange,
                DollarChange = request.DollarChange,
                Notes = request.Notes
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
            // Find the date for this snapshot ID
            var snapshotRecord = await _context.NetWorth
                .FirstOrDefaultAsync(n => n.Id == snapshotId);

            if (snapshotRecord == null)
            {
                return false;
            }

            // Delete all records for this date
            var allRecords = await _context.NetWorth
                .Where(n => n.Date == snapshotRecord.Date)
                .ToListAsync();

            _context.NetWorth.RemoveRange(allRecords);
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
