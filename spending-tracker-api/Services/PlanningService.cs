using Microsoft.EntityFrameworkCore;
using SpendingTrackerApi.Data;
using SpendingTrackerApi.Models;

namespace SpendingTrackerApi.Services;

public interface IPlanningService
{
    Task<IEnumerable<PlanningBudget>> GetPlanningBudgetsAsync(int scenarioId, int year);
    Task<PlanningBudget?> GetPlanningBudgetAsync(int categoryId, int scenarioId, int year);
    Task<PlanningBudget> SavePlanningBudgetAsync(int categoryId, int scenarioId, int year, decimal plannedAmount);
    Task DeletePlanningBudgetAsync(int categoryId, int scenarioId, int year);
}

public class PlanningService : IPlanningService
{
    private readonly SpendingDbContext _context;

    public PlanningService(SpendingDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<PlanningBudget>> GetPlanningBudgetsAsync(int scenarioId, int year)
    {
        return await _context.PlanningBudgets
            .Include(p => p.Category)
            .Include(p => p.Scenario)
            .Where(p => p.ScenarioId == scenarioId && p.Year == year)
            .ToListAsync();
    }

    public async Task<PlanningBudget?> GetPlanningBudgetAsync(int categoryId, int scenarioId, int year)
    {
        return await _context.PlanningBudgets
            .Include(p => p.Category)
            .Include(p => p.Scenario)
            .FirstOrDefaultAsync(p => p.CategoryId == categoryId && p.ScenarioId == scenarioId && p.Year == year);
    }

    public async Task<PlanningBudget> SavePlanningBudgetAsync(int categoryId, int scenarioId, int year, decimal plannedAmount)
    {
        var existingBudget = await _context.PlanningBudgets
            .FirstOrDefaultAsync(p => p.CategoryId == categoryId && p.ScenarioId == scenarioId && p.Year == year);

        if (existingBudget != null)
        {
            existingBudget.PlannedAmount = plannedAmount;
            existingBudget.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            existingBudget = new PlanningBudget
            {
                CategoryId = categoryId,
                ScenarioId = scenarioId,
                Year = year,
                PlannedAmount = plannedAmount,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.PlanningBudgets.Add(existingBudget);
        }

        await _context.SaveChangesAsync();

        // Return the budget with category and scenario included
        return await _context.PlanningBudgets
            .Include(p => p.Category)
            .Include(p => p.Scenario)
            .FirstAsync(p => p.PlanningBudgetId == existingBudget.PlanningBudgetId);
    }

    public async Task DeletePlanningBudgetAsync(int categoryId, int scenarioId, int year)
    {
        var budget = await _context.PlanningBudgets
            .FirstOrDefaultAsync(p => p.CategoryId == categoryId && p.ScenarioId == scenarioId && p.Year == year);

        if (budget != null)
        {
            _context.PlanningBudgets.Remove(budget);
            await _context.SaveChangesAsync();
        }
    }
}
