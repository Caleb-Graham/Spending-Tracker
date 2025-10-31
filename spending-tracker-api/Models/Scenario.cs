namespace SpendingTrackerApi.Models;

public class Scenario
{
    public int ScenarioId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public ICollection<PlanningBudget> PlanningBudgets { get; set; } = new List<PlanningBudget>();
}
