using Microsoft.EntityFrameworkCore;
using SpendingTrackerApi.Models;

namespace SpendingTrackerApi.Data;

public class SpendingDbContext : DbContext
{
    public SpendingDbContext(DbContextOptions<SpendingDbContext> options)
        : base(options)
    {
    }

    public DbSet<Transaction> Transactions { get; set; }
    public DbSet<Category> Categories { get; set; }
    public DbSet<Account> Accounts { get; set; }
    public DbSet<NetWorth> NetWorth { get; set; }
    public DbSet<PlanningBudget> PlanningBudgets { get; set; }
    public DbSet<Scenario> Scenarios { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure Transaction
        modelBuilder.Entity<Transaction>(entity =>
        {
            entity.HasKey(e => e.TransactionId);
            entity.Property(t => t.Amount)
                .HasColumnType("decimal(18,2)");

            entity.HasOne(t => t.Category)
                .WithMany(c => c.Transactions)
                .HasForeignKey(t => t.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(t => t.Account)
                .WithMany(a => a.Transactions)
                .HasForeignKey(t => t.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Configure Category
        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasKey(e => e.CategoryId);
            entity.Property(c => c.Type)
                .HasMaxLength(10)
                .HasConversion<string>();

            // Configure self-referencing relationship for parent-child categories
            entity.HasOne(c => c.ParentCategory)
                .WithMany(c => c.SubCategories)
                .HasForeignKey(c => c.ParentCategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            // Create separate unique constraints for parent and child categories
            // Parent categories: unique by Name and Type where ParentCategoryId is null
            entity.HasIndex(c => new { c.Name, c.Type, c.ParentCategoryId })
                .IsUnique()
                .HasDatabaseName("IX_Categories_Name_Type_ParentCategoryId_Parents")
                .HasFilter("ParentCategoryId IS NULL");

            // Child categories: unique by Name, Type, and ParentCategoryId where ParentCategoryId is not null
            entity.HasIndex(c => new { c.Name, c.Type, c.ParentCategoryId })
                .IsUnique()
                .HasDatabaseName("IX_Categories_Name_Type_ParentCategoryId_Children")
                .HasFilter("ParentCategoryId IS NOT NULL");
        });

        // Configure Account
        modelBuilder.Entity<Account>(entity =>
        {
            entity.HasKey(e => e.AccountId);
            entity.HasIndex(a => a.Name).IsUnique();
        });

        // Configure NetWorth
        modelBuilder.Entity<NetWorth>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(s => s.NetWorthTotal)
                .HasColumnType("decimal(18,2)");
            entity.Property(s => s.AccountValue)
                .HasColumnType("decimal(18,2)");

            // Create composite index for efficient querying
            entity.HasIndex(s => new { s.Date, s.AccountName });
        });

        // Configure PlanningBudget
        modelBuilder.Entity<PlanningBudget>(entity =>
        {
            entity.HasKey(e => e.PlanningBudgetId);
            entity.Property(p => p.PlannedAmount)
                .HasColumnType("decimal(18,2)");

            entity.HasOne(p => p.Category)
                .WithMany()
                .HasForeignKey(p => p.CategoryId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(p => p.Scenario)
                .WithMany(s => s.PlanningBudgets)
                .HasForeignKey(p => p.ScenarioId)
                .OnDelete(DeleteBehavior.Cascade);

            // Create unique constraint on CategoryId, ScenarioId, and Year combination
            entity.HasIndex(p => new { p.CategoryId, p.ScenarioId, p.Year }).IsUnique();
        });

        // Configure Scenario
        modelBuilder.Entity<Scenario>(entity =>
        {
            entity.HasKey(e => e.ScenarioId);
            entity.Property(s => s.Name)
                .HasMaxLength(100)
                .IsRequired();
            entity.Property(s => s.Description)
                .HasMaxLength(500);

            // Ensure scenario names are unique
            entity.HasIndex(s => s.Name).IsUnique();
        });

        // Seed initial account and default scenario only
        modelBuilder.Entity<Account>().HasData(
            new Account { AccountId = 1, Name = "Caleb Expenses" }
        );

        modelBuilder.Entity<Scenario>().HasData(
            new Scenario
            {
                ScenarioId = 1,
                Name = "Base Scenario",
                Description = "Initial planning scenario",
                CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                UpdatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );
    }
}
