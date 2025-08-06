using CsvHelper;
using CsvHelper.Configuration;
using System.Globalization;
using SpendingTrackerApi.Models;
using SpendingTrackerApi.Data;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Collections.Generic;

namespace SpendingTrackerApi.Methods;

public class TransactionMethods
{
    private readonly SpendingDbContext _context;

    public TransactionMethods(SpendingDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<TransactionDto>> GetTransactionsAsync()
    {
        try
        {
            return await _context.Transactions
                .Select(t => new TransactionDto
                {
                    TransactionId = t.TransactionId,
                    Date = t.Date,
                    Note = t.Note,
                    Amount = t.Amount,
                    CategoryId = t.CategoryId,
                    AccountId = t.AccountId,
                    IsIncome = t.Amount > 0,
                    Category = t.Category != null ? new CategoryDto
                    {
                        CategoryId = t.Category.CategoryId,
                        Name = t.Category.Name ?? string.Empty,
                        Type = t.Category.Type ?? string.Empty
                    } : null,
                    Account = t.Account != null ? new AccountDto
                    {
                        AccountId = t.Account.AccountId,
                        Name = t.Account.Name ?? string.Empty
                    } : null
                })
                .OrderByDescending(t => t.Date)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to fetch transactions: {ex.Message}");
        }
    }

    public async Task<IEnumerable<CategorySummaryDto>> GetCategorySummaryAsync(DateTime? startDate = null, DateTime? endDate = null)
    {
        try
        {
            var query = _context.Transactions.AsQueryable();

            // Filter by date range if provided
            if (startDate.HasValue)
            {
                query = query.Where(t => t.Date >= startDate.Value);
            }
            if (endDate.HasValue)
            {
                query = query.Where(t => t.Date <= endDate.Value);
            }

            // Only include expense transactions (negative amounts) for spending summary
            query = query.Where(t => t.Amount < 0);

            var categoryTotals = await query
                .Include(t => t.Category)
                .ThenInclude(c => c.ParentCategory)
                .GroupBy(t => new
                {
                    ParentCategoryId = t.Category.ParentCategory != null ? t.Category.ParentCategory.CategoryId : t.Category.CategoryId,
                    ParentCategoryName = t.Category.ParentCategory != null ? t.Category.ParentCategory.Name : t.Category.Name
                })
                .Select(g => new
                {
                    CategoryId = g.Key.ParentCategoryId,
                    CategoryName = g.Key.ParentCategoryName ?? "Uncategorized",
                    TotalAmount = g.Sum(t => t.Amount) // Keep as negative, we'll make positive later
                })
                .ToListAsync(); // Bring to client side before ordering

            // Calculate total spending and make amounts positive on client side
            var totalSpending = categoryTotals.Sum(x => Math.Abs(x.TotalAmount));

            return categoryTotals.Select(ct => new CategorySummaryDto
            {
                CategoryId = ct.CategoryId,
                CategoryName = ct.CategoryName,
                Amount = Math.Abs(ct.TotalAmount), // Make positive for display
                Percentage = totalSpending > 0 ? (double)(Math.Abs(ct.TotalAmount) / totalSpending) * 100 : 0
            }).OrderByDescending(x => x.Amount); // Order by highest spending first on client side
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to fetch category summary: {ex.Message}");
        }
    }

    public async Task<IncomeExpenseSummaryDto> GetIncomeExpenseSummaryAsync(DateTime? startDate = null, DateTime? endDate = null)
    {
        try
        {
            var query = _context.Transactions.AsQueryable();

            // Filter by date range if provided
            if (startDate.HasValue)
            {
                query = query.Where(t => t.Date >= startDate.Value);
            }
            if (endDate.HasValue)
            {
                query = query.Where(t => t.Date <= endDate.Value);
            }

            // Get income transactions (positive amounts)
            var incomeQuery = query.Where(t => t.Amount > 0);
            var incomeByCategory = await incomeQuery
                .Include(t => t.Category)
                .ThenInclude(c => c.ParentCategory)
                .GroupBy(t => new
                {
                    CategoryId = t.Category.CategoryId,
                    CategoryName = t.Category.Name,
                    ParentCategoryId = t.Category.ParentCategory != null ? t.Category.ParentCategory.CategoryId : (int?)null,
                    ParentCategoryName = t.Category.ParentCategory != null ? t.Category.ParentCategory.Name : null
                })
                .Select(g => new
                {
                    CategoryId = g.Key.CategoryId,
                    CategoryName = g.Key.CategoryName,
                    TotalAmount = g.Sum(t => t.Amount),
                    ParentCategoryName = g.Key.ParentCategoryName
                })
                .ToListAsync();

            // Filter to include income categories:
            // 1. Categories with "Income" as parent (properly categorized income)
            // 2. Direct "Income" categories 
            // 3. Any category with positive transactions that should be considered income
            //    (this handles cases where income transactions are miscategorized)
            var filteredIncomeByCategory = incomeByCategory
                .Where(cat => cat.ParentCategoryName == "Income" ||
                             (cat.ParentCategoryName == null && cat.CategoryName == "Income") ||
                             (cat.ParentCategoryName == null && cat.CategoryName == "Other" && cat.TotalAmount > 0))
                .Select(cat => new
                {
                    CategoryId = cat.CategoryId,
                    CategoryName = cat.CategoryName,
                    TotalAmount = cat.TotalAmount
                })
                .ToList();

            // Get expense transactions (negative amounts)
            var expenseQuery = query.Where(t => t.Amount < 0);
            var expenseByCategory = await expenseQuery
                .Include(t => t.Category)
                .ThenInclude(c => c.ParentCategory)
                .GroupBy(t => new
                {
                    ParentCategoryId = t.Category.ParentCategory != null ? t.Category.ParentCategory.CategoryId : t.Category.CategoryId,
                    ParentCategoryName = t.Category.ParentCategory != null ? t.Category.ParentCategory.Name : t.Category.Name
                })
                .Select(g => new
                {
                    CategoryId = g.Key.ParentCategoryId,
                    CategoryName = g.Key.ParentCategoryName ?? "Uncategorized",
                    TotalAmount = g.Sum(t => t.Amount)
                })
                .ToListAsync();

            // Calculate totals for percentage calculations
            var totalIncome = filteredIncomeByCategory.Sum(x => x.TotalAmount);
            var totalExpenses = Math.Abs(expenseByCategory.Sum(x => x.TotalAmount));

            var incomeSummary = filteredIncomeByCategory.Select(ct => new CategorySummaryDto
            {
                CategoryId = ct.CategoryId,
                CategoryName = ct.CategoryName,
                Amount = ct.TotalAmount,
                Percentage = totalIncome > 0 ? (double)(ct.TotalAmount / totalIncome) * 100 : 0
            }).OrderByDescending(x => x.Amount);

            var expenseSummary = expenseByCategory.Select(ct => new CategorySummaryDto
            {
                CategoryId = ct.CategoryId,
                CategoryName = ct.CategoryName,
                Amount = Math.Abs(ct.TotalAmount),
                Percentage = totalExpenses > 0 ? (double)(Math.Abs(ct.TotalAmount) / totalExpenses) * 100 : 0
            }).OrderByDescending(x => x.Amount);

            return new IncomeExpenseSummaryDto
            {
                Income = incomeSummary,
                Expenses = expenseSummary
            };
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to fetch income/expense summary: {ex.Message}");
        }
    }

    public async Task<IEnumerable<DetailedCategorySummaryDto>> GetDetailedCategorySummaryAsync(DateTime? startDate = null, DateTime? endDate = null)
    {
        try
        {
            var query = _context.Transactions.AsQueryable();

            // Filter by date range if provided
            if (startDate.HasValue)
            {
                query = query.Where(t => t.Date >= startDate.Value);
            }
            if (endDate.HasValue)
            {
                query = query.Where(t => t.Date <= endDate.Value);
            }

            // Only include expense transactions (negative amounts) for spending summary
            query = query.Where(t => t.Amount < 0);

            var categoryTotals = await query
                .Include(t => t.Category)
                .ThenInclude(c => c.ParentCategory)
                .GroupBy(t => new
                {
                    CategoryId = t.Category.CategoryId,
                    CategoryName = t.Category.Name,
                    ParentCategoryId = t.Category.ParentCategory != null ? t.Category.ParentCategory.CategoryId : (int?)null,
                    ParentCategoryName = t.Category.ParentCategory != null ? t.Category.ParentCategory.Name : null,
                    Type = t.Category.Type
                })
                .Select(g => new
                {
                    CategoryId = g.Key.CategoryId,
                    CategoryName = g.Key.CategoryName,
                    TotalAmount = g.Sum(t => t.Amount), // Keep as negative, we'll make positive later
                    ParentCategoryId = g.Key.ParentCategoryId,
                    ParentCategoryName = g.Key.ParentCategoryName,
                    Type = g.Key.Type
                })
                .ToListAsync(); // Bring to client side before ordering

            // Calculate total spending and make amounts positive on client side
            var totalSpending = categoryTotals.Sum(x => Math.Abs(x.TotalAmount));

            return categoryTotals.Select(ct => new DetailedCategorySummaryDto
            {
                CategoryId = ct.CategoryId,
                CategoryName = ct.CategoryName,
                Amount = Math.Abs(ct.TotalAmount), // Make positive for display
                Percentage = totalSpending > 0 ? (double)(Math.Abs(ct.TotalAmount) / totalSpending) * 100 : 0,
                ParentCategoryId = ct.ParentCategoryId,
                ParentCategoryName = ct.ParentCategoryName,
                Type = ct.Type
            }).OrderByDescending(x => x.Amount); // Order by highest spending first on client side
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to fetch detailed category summary: {ex.Message}");
        }
    }

    public async Task<ImportResult> ImportTransactionsFromCsv(Stream csvStream)
    {
        List<TransactionCsvRecord> records;
        int totalRecords = 0;
        int duplicatesSkipped = 0;
        int newTransactionsAdded = 0;

        using var reader = new StreamReader(csvStream);
        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HeaderValidated = null,
            MissingFieldFound = null,
            Delimiter = "\t",  // Use tab as delimiter
            TrimOptions = TrimOptions.Trim
        };

        try
        {
            using var csv = new CsvReader(reader, config);

            // Register custom class map for your CSV format
            csv.Context.RegisterClassMap<TransactionCsvMap>();

            records = csv.GetRecords<TransactionCsvRecord>().ToList();
            totalRecords = records.Count;
            if (!records.Any())
            {
                throw new Exception("No records found in the CSV file.");
            }

            foreach (var record in records)
            {
                // Check for duplicate transaction
                var existingTransaction = await _context.Transactions
                    .Include(t => t.Account)
                    .Include(t => t.Category)
                    .FirstOrDefaultAsync(t =>
                        t.Date.Date == record.Date.Date &&
                        t.Amount == record.Amount &&
                        t.Note == (record.Note ?? string.Empty) &&
                        t.Account.Name == record.Account);

                if (existingTransaction != null)
                {
                    // Skip this transaction as it's likely a duplicate
                    duplicatesSkipped++;
                    continue;
                }

                // Ensure account exists
                var account = await _context.Accounts
                    .FirstOrDefaultAsync(a => a.Name == record.Account);

                if (account == null)
                {
                    account = new Account { Name = record.Account };
                    _context.Accounts.Add(account);
                    await _context.SaveChangesAsync();
                }

                // Ensure category exists
                var category = await _context.Categories
                    .FirstOrDefaultAsync(c => c.Name == record.Category);

                if (category == null)
                {
                    // Find or create the "Unassigned" parent category for the appropriate type
                    var categoryType = record.Amount > 0 ? "Income" : "Expense";
                    var unassignedParent = await _context.Categories
                        .FirstOrDefaultAsync(c => c.Name == "Unassigned" && c.Type == categoryType && c.ParentCategoryId == null);

                    // Create "Unassigned" parent category if it doesn't exist
                    if (unassignedParent == null)
                    {
                        unassignedParent = new Category
                        {
                            Name = "Unassigned",
                            Type = categoryType,
                            ParentCategoryId = null // This makes it a parent category
                        };
                        _context.Categories.Add(unassignedParent);
                        await _context.SaveChangesAsync();
                    }

                    // Create new category as a child of "Unassigned"
                    category = new Category
                    {
                        Name = record.Category,
                        Type = categoryType,
                        ParentCategoryId = unassignedParent.CategoryId // Always assign as child of "Unassigned"
                    };
                    _context.Categories.Add(category);
                    await _context.SaveChangesAsync();
                }

                var transaction = new Transaction
                {
                    Date = record.Date,
                    Amount = record.Amount,
                    Note = record.Note ?? string.Empty,
                    CategoryId = category.CategoryId,
                    AccountId = account.AccountId
                };

                _context.Transactions.Add(transaction);
                newTransactionsAdded++;
            }

            await _context.SaveChangesAsync();

            return new ImportResult
            {
                TotalRecords = totalRecords,
                NewTransactions = newTransactionsAdded,
                DuplicatesSkipped = duplicatesSkipped
            };
        }
        catch (CsvHelper.MissingFieldException ex)
        {
            throw new Exception($"CSV format error: Missing required field. {ex.Message}");
        }
        catch (CsvHelper.TypeConversion.TypeConverterException ex)
        {
            throw new Exception($"CSV data error: Invalid data format. {ex.Message}");
        }
        catch (Exception ex)
        {
            throw new Exception($"Error processing CSV file: {ex.Message}");
        }
    }
}

public class ImportResult
{
    public int TotalRecords { get; set; }
    public int NewTransactions { get; set; }
    public int DuplicatesSkipped { get; set; }
}

public class TransactionDto
{
    public int TransactionId { get; set; }
    public DateTime Date { get; set; }
    public decimal Amount { get; set; }
    public string Note { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public int AccountId { get; set; }
    public bool IsIncome { get; set; }
    public CategoryDto? Category { get; set; }
    public AccountDto? Account { get; set; }
}

public class CategoryDto
{
    public int CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public int? ParentCategoryId { get; set; }
    public string? ParentCategoryName { get; set; }
}

public class AccountDto
{
    public int AccountId { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class CategorySummaryDto
{
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public double Percentage { get; set; }
}

public class DetailedCategorySummaryDto
{
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public double Percentage { get; set; }
    public int? ParentCategoryId { get; set; }
    public string? ParentCategoryName { get; set; }
    public string Type { get; set; } = string.Empty;
}

public class IncomeExpenseSummaryDto
{
    public IEnumerable<CategorySummaryDto> Income { get; set; } = new List<CategorySummaryDto>();
    public IEnumerable<CategorySummaryDto> Expenses { get; set; } = new List<CategorySummaryDto>();
}
