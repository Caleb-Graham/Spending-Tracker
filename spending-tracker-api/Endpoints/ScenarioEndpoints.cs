using Microsoft.AspNetCore.Mvc;
using SpendingTrackerApi.Models;
using SpendingTrackerApi.Services;

namespace SpendingTrackerApi.Endpoints;

public static class ScenarioEndpoints
{
    public static void MapScenarioEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/scenarios");

        // GET /api/scenarios - Get all scenarios
        group.MapGet("/", async (IScenarioService scenarioService) =>
        {
            try
            {
                var scenarios = await scenarioService.GetScenariosAsync();
                return Results.Ok(scenarios);
            }
            catch (Exception ex)
            {
                return Results.Problem($"Error retrieving scenarios: {ex.Message}");
            }
        });

        // GET /api/scenarios/{id} - Get scenario by ID
        group.MapGet("/{id:int}", async (int id, IScenarioService scenarioService) =>
        {
            try
            {
                var scenario = await scenarioService.GetScenarioAsync(id);
                return scenario != null ? Results.Ok(scenario) : Results.NotFound();
            }
            catch (Exception ex)
            {
                return Results.Problem($"Error retrieving scenario: {ex.Message}");
            }
        });

        // POST /api/scenarios - Create new scenario
        group.MapPost("/", async ([FromBody] CreateScenarioRequest request, IScenarioService scenarioService) =>
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Name))
                    return Results.BadRequest(new { error = "Scenario name is required" });

                var scenario = await scenarioService.CreateScenarioAsync(request.Name, request.Description);
                return Results.Created($"/api/scenarios/{scenario.ScenarioId}", scenario);
            }
            catch (Exception ex)
            {
                return Results.Problem($"Error creating scenario: {ex.Message}");
            }
        });

        // PUT /api/scenarios/{id} - Update scenario
        group.MapPut("/{id:int}", async (int id, [FromBody] UpdateScenarioRequest request, IScenarioService scenarioService) =>
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Name))
                    return Results.BadRequest(new { error = "Scenario name is required" });

                var scenario = await scenarioService.UpdateScenarioAsync(id, request.Name, request.Description);
                return Results.Ok(scenario);
            }
            catch (ArgumentException)
            {
                return Results.NotFound();
            }
            catch (Exception ex)
            {
                return Results.Problem($"Error updating scenario: {ex.Message}");
            }
        });

        // DELETE /api/scenarios/{id} - Delete scenario
        group.MapDelete("/{id:int}", async (int id, IScenarioService scenarioService) =>
        {
            try
            {
                await scenarioService.DeleteScenarioAsync(id);
                return Results.NoContent();
            }
            catch (ArgumentException)
            {
                return Results.NotFound();
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                return Results.Problem($"Error deleting scenario: {ex.Message}");
            }
        });

        // POST /api/scenarios/{id}/duplicate - Duplicate scenario
        group.MapPost("/{id:int}/duplicate", async (int id, [FromBody] DuplicateScenarioRequest request, IScenarioService scenarioService) =>
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Name))
                    return Results.BadRequest(new { error = "New scenario name is required" });

                var scenario = await scenarioService.DuplicateScenarioAsync(id, request.Name, request.Description);
                return Results.Created($"/api/scenarios/{scenario.ScenarioId}", scenario);
            }
            catch (ArgumentException)
            {
                return Results.NotFound();
            }
            catch (Exception ex)
            {
                return Results.Problem($"Error duplicating scenario: {ex.Message}");
            }
        });
    }
}

public record CreateScenarioRequest(string Name, string? Description);
public record UpdateScenarioRequest(string Name, string? Description);
public record DuplicateScenarioRequest(string Name, string? Description);
