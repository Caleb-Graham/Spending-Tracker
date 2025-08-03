using SpendingTrackerApi.Methods;

namespace SpendingTrackerApi.Functions;

public static class NetWorthFunctions
{
    public static void MapNetWorthFunctions(this WebApplication app)
    {
        var group = app.MapGroup("/api/networth")
            .WithTags("NetWorth");

        // Get net worth snapshots with optional date filtering
        group.MapGet("", GetNetWorthSnapshots);

        // Get detailed net worth snapshot by ID
        group.MapGet("/{snapshotId:int}", GetNetWorthDetail);

        // Get category summary for a specific snapshot
        group.MapGet("/{snapshotId:int}/categories", GetNetWorthCategorySummary);

        // Create new net worth snapshot
        group.MapPost("", CreateNetWorthSnapshot);

        // Delete net worth snapshot
        group.MapDelete("/{snapshotId:int}", DeleteNetWorthSnapshot);
    }

    private static async Task<IResult> GetNetWorthSnapshots(
        NetWorthMethods netWorthMethods,
        DateTime? startDate = null,
        DateTime? endDate = null)
    {
        try
        {
            var snapshots = await netWorthMethods.GetNetWorthSnapshotsAsync(startDate, endDate);
            return Results.Ok(new { data = snapshots });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }

    private static async Task<IResult> GetNetWorthDetail(NetWorthMethods netWorthMethods, int snapshotId)
    {
        try
        {
            var detail = await netWorthMethods.GetNetWorthDetailAsync(snapshotId);
            if (detail == null)
            {
                return Results.NotFound(new { error = new { message = "Net worth snapshot not found" } });
            }
            return Results.Ok(new { data = detail });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }

    private static async Task<IResult> GetNetWorthCategorySummary(NetWorthMethods netWorthMethods, int snapshotId)
    {
        try
        {
            var summary = await netWorthMethods.GetNetWorthCategorySummaryAsync(snapshotId);
            return Results.Ok(new { data = summary });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }

    private static async Task<IResult> CreateNetWorthSnapshot(
        NetWorthMethods netWorthMethods,
        CreateNetWorthSnapshotRequest request)
    {
        try
        {
            var snapshot = await netWorthMethods.CreateNetWorthSnapshotAsync(request);
            return Results.Created($"/api/networth/{snapshot.SnapshotId}", new { data = snapshot });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }

    private static async Task<IResult> DeleteNetWorthSnapshot(NetWorthMethods netWorthMethods, int snapshotId)
    {
        try
        {
            var deleted = await netWorthMethods.DeleteNetWorthSnapshotAsync(snapshotId);
            if (!deleted)
            {
                return Results.NotFound(new { error = new { message = "Net worth snapshot not found" } });
            }
            return Results.Ok(new { message = "Net worth snapshot deleted successfully" });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }
}
