namespace SpendingTrackerApi.Models;

public class Category
{
    public int CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // "Income" or "Expense"

    // Parent category relationship
    public int? ParentCategoryId { get; set; }
    public Category? ParentCategory { get; set; }

    // Child categories (sub-categories)
    public ICollection<Category> SubCategories { get; set; } = new List<Category>();

    // Transactions using this category
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
}
