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

            // Create a unique constraint on Name and Type combination
            entity.HasIndex(c => new { c.Name, c.Type }).IsUnique();
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

        // Seed initial account only
        modelBuilder.Entity<Account>().HasData(
            new Account { AccountId = 1, Name = "Caleb Expenses" }
        );
    }
}
