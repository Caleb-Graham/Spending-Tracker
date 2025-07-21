using SpendingTrackerApi.Methods;
using static SpendingTrackerApi.Methods.CategoryMethods;

namespace SpendingTrackerApi.Functions;

public static class CategoryFunctions
{
    public static void MapCategoryFunctions(this WebApplication app)
    {
        var group = app.MapGroup("/api/categories")
            .WithTags("Categories");

        // Category summary endpoint
        group.MapGet("/summary", GetCategorySummary);
        group.MapGet("/detailed-summary", GetDetailedCategorySummary);
        group.MapGet("/income-expense-summary", GetIncomeExpenseSummary);

        // Category management endpoints
        group.MapGet("", GetAllCategories);
        group.MapGet("/parents", GetParentCategories);
        group.MapGet("/mappings", GetCategoryMappings);

        // Parent category CRUD operations
        group.MapPost("/parents", CreateParentCategory);
        group.MapPut("/parents/{categoryId}", UpdateParentCategory);
        group.MapDelete("/parents/{categoryId}", DeleteParentCategory);

        // Child category CRUD operations
        group.MapPost("/mappings", CreateCategoryMapping);
        group.MapPut("/mappings/{categoryId}", UpdateCategoryMapping);
        group.MapDelete("/mappings/{categoryId}", DeleteCategoryMapping);
    }

    private static async Task<IResult> GetCategorySummary(TransactionMethods transactionMethods, DateTime? startDate, DateTime? endDate)
    {
        try
        {
            var categorySummary = await transactionMethods.GetCategorySummaryAsync(startDate, endDate);
            return Results.Ok(new { data = categorySummary });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }

    private static async Task<IResult> GetDetailedCategorySummary(TransactionMethods transactionMethods, DateTime? startDate, DateTime? endDate)
    {
        try
        {
            var detailedCategorySummary = await transactionMethods.GetDetailedCategorySummaryAsync(startDate, endDate);
            return Results.Ok(new { data = detailedCategorySummary });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }

    private static async Task<IResult> GetIncomeExpenseSummary(TransactionMethods transactionMethods, DateTime? startDate, DateTime? endDate)
    {
        try
        {
            var incomeExpenseSummary = await transactionMethods.GetIncomeExpenseSummaryAsync(startDate, endDate);
            return Results.Ok(new { data = incomeExpenseSummary });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }

    private static async Task<IResult> GetAllCategories(CategoryMethods categoryMethods)
    {
        try
        {
            var categories = await categoryMethods.GetAllCategoriesAsync();
            return Results.Ok(new { data = categories });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }

    private static async Task<IResult> GetParentCategories(CategoryMethods categoryMethods, string? type = null)
    {
        try
        {
            var parentCategories = await categoryMethods.GetParentCategoriesAsync(type);
            return Results.Ok(new { data = parentCategories });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }

    private static async Task<IResult> GetCategoryMappings(CategoryMethods categoryMethods, string? type = null)
    {
        try
        {
            var mappings = await categoryMethods.GetCategoryMappingsAsync(type);
            return Results.Ok(new { data = mappings });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }

    private static async Task<IResult> CreateCategoryMapping(CategoryMethods categoryMethods, CreateCategoryMappingRequest request)
    {
        try
        {
            var mapping = await categoryMethods.CreateCategoryMappingAsync(request);
            return Results.Ok(new { data = mapping });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }

    private static async Task<IResult> UpdateCategoryMapping(CategoryMethods categoryMethods, int categoryId, UpdateCategoryMappingRequest request)
    {
        try
        {
            var mapping = await categoryMethods.UpdateCategoryMappingAsync(categoryId, request);
            return Results.Ok(new { data = mapping });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }

    private static async Task<IResult> DeleteCategoryMapping(CategoryMethods categoryMethods, int categoryId)
    {
        try
        {
            var success = await categoryMethods.DeleteCategoryMappingAsync(categoryId);
            if (success)
            {
                return Results.Ok(new { message = "Category mapping deleted successfully" });
            }
            return Results.NotFound(new { error = new { message = "Category not found" } });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }

    // Parent category endpoints
    private static async Task<IResult> CreateParentCategory(CategoryMethods categoryMethods, CreateParentCategoryRequest request)
    {
        try
        {
            var category = await categoryMethods.CreateParentCategoryAsync(request);
            return Results.Ok(new { data = category });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }

    private static async Task<IResult> UpdateParentCategory(CategoryMethods categoryMethods, int categoryId, UpdateParentCategoryRequest request)
    {
        try
        {
            var category = await categoryMethods.UpdateParentCategoryAsync(categoryId, request);
            return Results.Ok(new { data = category });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }

    private static async Task<IResult> DeleteParentCategory(CategoryMethods categoryMethods, int categoryId)
    {
        try
        {
            var success = await categoryMethods.DeleteParentCategoryAsync(categoryId);
            if (success)
            {
                return Results.Ok(new { message = "Parent category deleted successfully" });
            }
            return Results.NotFound(new { error = new { message = "Parent category not found" } });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = new { message = ex.Message } });
        }
    }
}
