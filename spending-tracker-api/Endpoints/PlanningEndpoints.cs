using SpendingTrackerApi.Services;
using SpendingTrackerApi.Models;

namespace SpendingTrackerApi.Endpoints;

public static class PlanningEndpoints
{
    public static void MapPlanningEndpoints(this WebApplication app)
    {
        var planningGroup = app.MapGroup("/api/planning")
            .WithTags("Planning");

        // GET /api/planning/{scenarioId}/{year} - Get all planning budgets for a scenario and year
        planningGroup.MapGet("/{scenarioId:int}/{year:int}", async (int scenarioId, int year, IPlanningService planningService) =>
        {
            var budgets = await planningService.GetPlanningBudgetsAsync(scenarioId, year);
            return Results.Ok(budgets);
        })
        .WithName("GetPlanningBudgets")
        .WithSummary("Get all planning budgets for a specific scenario and year");

        // GET /api/planning/{categoryId}/{scenarioId}/{year} - Get planning budget for a specific category, scenario and year
        planningGroup.MapGet("/{categoryId:int}/{scenarioId:int}/{year:int}", async (int categoryId, int scenarioId, int year, IPlanningService planningService) =>
        {
            var budget = await planningService.GetPlanningBudgetAsync(categoryId, scenarioId, year);
            return budget != null ? Results.Ok(budget) : Results.NotFound();
        })
        .WithName("GetPlanningBudget")
        .WithSummary("Get planning budget for a specific category, scenario and year");

        // POST /api/planning - Save or update planning budget
        planningGroup.MapPost("/", async (SavePlanningBudgetRequest request, IPlanningService planningService) =>
        {
            try
            {
                var budget = await planningService.SavePlanningBudgetAsync(
                    request.CategoryId,
                    request.ScenarioId,
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

        // DELETE /api/planning/{categoryId}/{scenarioId}/{year} - Delete planning budget
        planningGroup.MapDelete("/{categoryId:int}/{scenarioId:int}/{year:int}", async (int categoryId, int scenarioId, int year, IPlanningService planningService) =>
        {
            await planningService.DeletePlanningBudgetAsync(categoryId, scenarioId, year);
            return Results.Ok();
        })
        .WithName("DeletePlanningBudget")
        .WithSummary("Delete a planning budget");
    }
}

public record SavePlanningBudgetRequest(int CategoryId, int ScenarioId, int Year, decimal PlannedAmount);
