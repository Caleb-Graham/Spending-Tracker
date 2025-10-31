using Microsoft.EntityFrameworkCore;
using SpendingTrackerApi.Data;
using SpendingTrackerApi.Models;

namespace SpendingTrackerApi.Services;

public interface IScenarioService
{
    Task<IEnumerable<Scenario>> GetScenariosAsync();
    Task<Scenario?> GetScenarioAsync(int scenarioId);
    Task<Scenario> CreateScenarioAsync(string name, string? description = null);
    Task<Scenario> UpdateScenarioAsync(int scenarioId, string name, string? description = null);
    Task DeleteScenarioAsync(int scenarioId);
    Task<Scenario> DuplicateScenarioAsync(int sourceScenarioId, string newName, string? newDescription = null);
}

public class ScenarioService : IScenarioService
{
    private readonly SpendingDbContext _context;

    public ScenarioService(SpendingDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Scenario>> GetScenariosAsync()
    {
        return await _context.Scenarios
            .OrderBy(s => s.Name)
            .ToListAsync();
    }

    public async Task<Scenario?> GetScenarioAsync(int scenarioId)
    {
        return await _context.Scenarios
            .FirstOrDefaultAsync(s => s.ScenarioId == scenarioId);
    }

    public async Task<Scenario> CreateScenarioAsync(string name, string? description = null)
    {
        var scenario = new Scenario
        {
            Name = name,
            Description = description,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Scenarios.Add(scenario);
        await _context.SaveChangesAsync();

        return scenario;
    }

    public async Task<Scenario> UpdateScenarioAsync(int scenarioId, string name, string? description = null)
    {
        var scenario = await _context.Scenarios.FindAsync(scenarioId);
        if (scenario == null)
            throw new ArgumentException("Scenario not found", nameof(scenarioId));

        scenario.Name = name;
        scenario.Description = description;
        scenario.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return scenario;
    }

    public async Task DeleteScenarioAsync(int scenarioId)
    {
        var scenario = await _context.Scenarios.FindAsync(scenarioId);
        if (scenario == null)
            throw new ArgumentException("Scenario not found", nameof(scenarioId));

        // Delete associated planning budgets first
        var planningBudgets = await _context.PlanningBudgets
            .Where(pb => pb.ScenarioId == scenarioId)
            .ToListAsync();

        _context.PlanningBudgets.RemoveRange(planningBudgets);
        _context.Scenarios.Remove(scenario);

        await _context.SaveChangesAsync();
    }
    public async Task<Scenario> DuplicateScenarioAsync(int sourceScenarioId, string newName, string? newDescription = null)
    {
        var sourceScenario = await _context.Scenarios
            .Include(s => s.PlanningBudgets)
            .FirstOrDefaultAsync(s => s.ScenarioId == sourceScenarioId);

        if (sourceScenario == null)
            throw new ArgumentException("Source scenario not found", nameof(sourceScenarioId));

        var newScenario = new Scenario
        {
            Name = newName,
            Description = newDescription,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Scenarios.Add(newScenario);
        await _context.SaveChangesAsync();

        // Copy all planning budgets from source scenario
        foreach (var sourceBudget in sourceScenario.PlanningBudgets)
        {
            var newBudget = new PlanningBudget
            {
                CategoryId = sourceBudget.CategoryId,
                ScenarioId = newScenario.ScenarioId,
                Year = sourceBudget.Year,
                PlannedAmount = sourceBudget.PlannedAmount,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.PlanningBudgets.Add(newBudget);
        }

        await _context.SaveChangesAsync();
        return newScenario;
    }
}
