namespace SpendingTrackerApi.Models;

public class PlanningBudget
{
    public int PlanningBudgetId { get; set; }
    public int CategoryId { get; set; }
    public int ScenarioId { get; set; }
    public int Year { get; set; }
    public decimal PlannedAmount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public Category Category { get; set; } = null!;
    public Scenario Scenario { get; set; } = null!;
}
