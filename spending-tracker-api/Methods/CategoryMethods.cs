using Microsoft.EntityFrameworkCore;
using SpendingTrackerApi.Data;
using SpendingTrackerApi.Models;

namespace SpendingTrackerApi.Methods;

public class CategoryMethods
{
    private readonly SpendingDbContext _context;

    public CategoryMethods(SpendingDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<CategoryDto>> GetAllCategoriesAsync()
    {
        try
        {
            return await _context.Categories
                .Include(c => c.ParentCategory)
                .Include(c => c.SubCategories)
                .Select(c => new CategoryDto
                {
                    CategoryId = c.CategoryId,
                    Name = c.Name,
                    Type = c.Type,
                    ParentCategoryId = c.ParentCategoryId,
                    ParentCategoryName = c.ParentCategory != null ? c.ParentCategory.Name : null
                })
                .ToListAsync();
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to fetch categories: {ex.Message}");
        }
    }

    public async Task<IEnumerable<CategoryDto>> GetParentCategoriesAsync(string? type = null)
    {
        try
        {
            var query = _context.Categories
                .Where(c => c.ParentCategoryId == null);

            if (!string.IsNullOrEmpty(type))
            {
                query = query.Where(c => c.Type == type);
            }

            return await query
                .Select(c => new CategoryDto
                {
                    CategoryId = c.CategoryId,
                    Name = c.Name,
                    Type = c.Type,
                    ParentCategoryId = null,
                    ParentCategoryName = null
                })
                .ToListAsync();
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to fetch parent categories: {ex.Message}");
        }
    }

    public async Task<IEnumerable<CategoryMappingDto>> GetCategoryMappingsAsync(string? type = null)
    {
        try
        {
            var query = _context.Categories
                .Where(c => c.ParentCategoryId != null); // Only sub-categories

            if (!string.IsNullOrEmpty(type))
            {
                query = query.Where(c => c.Type == type);
            }

            return await query
                .Include(c => c.ParentCategory)
                .Select(c => new CategoryMappingDto
                {
                    CategoryId = c.CategoryId,
                    CategoryName = c.Name,
                    ParentCategoryId = c.ParentCategoryId!.Value,
                    ParentCategoryName = c.ParentCategory!.Name
                })
                .ToListAsync();
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to fetch category mappings: {ex.Message}");
        }
    }

    public async Task<CategoryMappingDto> CreateCategoryMappingAsync(CreateCategoryMappingRequest request)
    {
        try
        {
            // Check if a child category with this name already exists under the same parent
            var existingChildCategory = await _context.Categories
                .FirstOrDefaultAsync(c => c.Name == request.CategoryName &&
                                        c.Type == request.Type &&
                                        c.ParentCategoryId == request.ParentCategoryId);

            if (existingChildCategory != null)
            {
                throw new Exception("A child category with this name already exists under this parent category");
            }

            // Check if category already exists as a standalone category (no parent)
            var existingStandaloneCategory = await _context.Categories
                .FirstOrDefaultAsync(c => c.Name == request.CategoryName &&
                                        c.Type == request.Type &&
                                        c.ParentCategoryId == null);

            if (existingStandaloneCategory != null)
            {
                // Update existing standalone category to have the new parent
                existingStandaloneCategory.ParentCategoryId = request.ParentCategoryId;
                await _context.SaveChangesAsync();

                var parentCategory = await _context.Categories.FindAsync(request.ParentCategoryId);
                return new CategoryMappingDto
                {
                    CategoryId = existingStandaloneCategory.CategoryId,
                    CategoryName = existingStandaloneCategory.Name,
                    ParentCategoryId = request.ParentCategoryId,
                    ParentCategoryName = parentCategory?.Name ?? ""
                };
            }
            else
            {
                // Create new child category
                var newCategory = new Category
                {
                    Name = request.CategoryName,
                    Type = request.Type,
                    ParentCategoryId = request.ParentCategoryId
                };

                _context.Categories.Add(newCategory);
                await _context.SaveChangesAsync();

                var parentCategory = await _context.Categories.FindAsync(request.ParentCategoryId);
                return new CategoryMappingDto
                {
                    CategoryId = newCategory.CategoryId,
                    CategoryName = newCategory.Name,
                    ParentCategoryId = request.ParentCategoryId,
                    ParentCategoryName = parentCategory?.Name ?? ""
                };
            }
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to create category mapping: {ex.Message}");
        }
    }

    public async Task<CategoryMappingDto> UpdateCategoryMappingAsync(int categoryId, UpdateCategoryMappingRequest request)
    {
        try
        {
            var category = await _context.Categories.FindAsync(categoryId);
            if (category == null)
            {
                throw new Exception("Category not found");
            }

            // Check if a child category with this name already exists under the same parent (excluding current category)
            var existingChildCategory = await _context.Categories
                .FirstOrDefaultAsync(c => c.Name == request.CategoryName &&
                                        c.Type == category.Type &&
                                        c.ParentCategoryId == request.ParentCategoryId &&
                                        c.CategoryId != categoryId);

            if (existingChildCategory != null)
            {
                throw new Exception("A child category with this name already exists under this parent category");
            }

            category.Name = request.CategoryName;
            category.ParentCategoryId = request.ParentCategoryId;

            await _context.SaveChangesAsync();

            var parentCategory = await _context.Categories.FindAsync(request.ParentCategoryId);
            return new CategoryMappingDto
            {
                CategoryId = category.CategoryId,
                CategoryName = category.Name,
                ParentCategoryId = request.ParentCategoryId,
                ParentCategoryName = parentCategory?.Name ?? ""
            };
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to update category mapping: {ex.Message}");
        }
    }

    public async Task<bool> DeleteCategoryMappingAsync(int categoryId)
    {
        try
        {
            var category = await _context.Categories.FindAsync(categoryId);
            if (category == null)
            {
                return false;
            }

            // Check if category has transactions
            var hasTransactions = await _context.Transactions.AnyAsync(t => t.CategoryId == categoryId);
            if (hasTransactions)
            {
                throw new Exception("Cannot delete category that has transactions. Please reassign transactions first.");
            }

            _context.Categories.Remove(category);
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to delete category mapping: {ex.Message}");
        }
    }

    // Parent category management methods
    public async Task<CategoryDto> CreateParentCategoryAsync(CreateParentCategoryRequest request)
    {
        try
        {
            // Check if a parent category with this name already exists
            var existingParentCategory = await _context.Categories
                .FirstOrDefaultAsync(c => c.Name == request.Name && c.Type == request.Type && c.ParentCategoryId == null);

            if (existingParentCategory != null)
            {
                throw new Exception("A parent category with this name already exists");
            }

            var category = new Category
            {
                Name = request.Name,
                Type = request.Type,
                ParentCategoryId = null
            };

            _context.Categories.Add(category);
            await _context.SaveChangesAsync();

            return new CategoryDto
            {
                CategoryId = category.CategoryId,
                Name = category.Name,
                Type = category.Type,
                ParentCategoryId = null,
                ParentCategoryName = null
            };
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to create parent category: {ex.Message}");
        }
    }

    public async Task<CategoryDto> UpdateParentCategoryAsync(int categoryId, UpdateParentCategoryRequest request)
    {
        try
        {
            var category = await _context.Categories.FindAsync(categoryId);
            if (category == null)
            {
                throw new Exception("Parent category not found");
            }

            if (category.ParentCategoryId != null)
            {
                throw new Exception("This is not a parent category");
            }

            // Check if another parent category with this name exists (excluding current category)
            var existingParentCategory = await _context.Categories
                .FirstOrDefaultAsync(c => c.Name == request.Name && c.Type == request.Type && c.ParentCategoryId == null && c.CategoryId != categoryId);

            if (existingParentCategory != null)
            {
                throw new Exception("A parent category with this name already exists");
            }

            category.Name = request.Name;
            category.Type = request.Type;

            await _context.SaveChangesAsync();

            return new CategoryDto
            {
                CategoryId = category.CategoryId,
                Name = category.Name,
                Type = category.Type,
                ParentCategoryId = null,
                ParentCategoryName = null
            };
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to update parent category: {ex.Message}");
        }
    }

    public async Task<bool> DeleteParentCategoryAsync(int categoryId)
    {
        try
        {
            var category = await _context.Categories
                .Include(c => c.SubCategories)
                .FirstOrDefaultAsync(c => c.CategoryId == categoryId);

            if (category == null)
            {
                return false;
            }

            if (category.ParentCategoryId != null)
            {
                throw new Exception("This is not a parent category");
            }

            // Check if parent category has child categories
            if (category.SubCategories.Any())
            {
                throw new Exception("Cannot delete parent category that has child categories. Please delete or reassign child categories first.");
            }

            // Check if the parent category itself has transactions directly assigned to it
            var hasDirectTransactions = await _context.Transactions.AnyAsync(t => t.CategoryId == categoryId);
            if (hasDirectTransactions)
            {
                throw new Exception("Cannot delete category that has transactions. Please reassign transactions first.");
            }

            // Since we already checked that there are no child categories above,
            // we don't need to check child category transactions

            _context.Categories.Remove(category);
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to delete parent category: {ex.Message}");
        }
    }
}

// DTOs for category management
public class CategoryMappingDto
{
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public int ParentCategoryId { get; set; }
    public string ParentCategoryName { get; set; } = string.Empty;
}

public class CreateCategoryMappingRequest
{
    public string CategoryName { get; set; } = string.Empty;
    public string Type { get; set; } = "Expense";
    public int ParentCategoryId { get; set; }
}

public class UpdateCategoryMappingRequest
{
    public string CategoryName { get; set; } = string.Empty;
    public int ParentCategoryId { get; set; }
}

// DTOs for parent category management
public class CreateParentCategoryRequest
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "Expense";
}

public class UpdateParentCategoryRequest
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "Expense";
}
