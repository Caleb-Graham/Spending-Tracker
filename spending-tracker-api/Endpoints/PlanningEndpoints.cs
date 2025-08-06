using SpendingTrackerApi.Services;
using SpendingTrackerApi.Models;

namespace SpendingTrackerApi.Endpoints;

public static class PlanningEndpoints
{
    public static void MapPlanningEndpoints(this WebApplication app)
    {
        var planningGroup = app.MapGroup("/api/planning")
            .WithTags("Planning");

        // GET /api/planning/{year} - Get all planning budgets for a year
        planningGroup.MapGet("/{year:int}", async (int year, IPlanningService planningService) =>
        {
            var budgets = await planningService.GetPlanningBudgetsAsync(year);
            return Results.Ok(budgets);
        })
        .WithName("GetPlanningBudgets")
        .WithSummary("Get all planning budgets for a specific year");

        // GET /api/planning/{categoryId}/{year} - Get planning budget for a specific category and year
        planningGroup.MapGet("/{categoryId:int}/{year:int}", async (int categoryId, int year, IPlanningService planningService) =>
        {
            var budget = await planningService.GetPlanningBudgetAsync(categoryId, year);
            return budget != null ? Results.Ok(budget) : Results.NotFound();
        })
        .WithName("GetPlanningBudget")
        .WithSummary("Get planning budget for a specific category and year");

        // POST /api/planning - Save or update planning budget
        planningGroup.MapPost("/", async (SavePlanningBudgetRequest request, IPlanningService planningService) =>
        {
            try
            {
                var budget = await planningService.SavePlanningBudgetAsync(
                    request.CategoryId,
                    request.Year,
                    request.PlannedAmount);

                return Results.Ok(budget);
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        })
        .WithName("SavePlanningBudget")
        .WithSummary("Save or update a planning budget");

        // DELETE /api/planning/{categoryId}/{year} - Delete planning budget
        planningGroup.MapDelete("/{categoryId:int}/{year:int}", async (int categoryId, int year, IPlanningService planningService) =>
        {
            await planningService.DeletePlanningBudgetAsync(categoryId, year);
            return Results.Ok();
        })
        .WithName("DeletePlanningBudget")
        .WithSummary("Delete a planning budget");
    }
}

public record SavePlanningBudgetRequest(int CategoryId, int Year, decimal PlannedAmount);
