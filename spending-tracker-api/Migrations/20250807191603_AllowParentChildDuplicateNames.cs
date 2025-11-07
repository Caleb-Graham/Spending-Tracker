using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace spending_tracker_api.Migrations
{
    /// <inheritdoc />
    public partial class AllowParentChildDuplicateNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop the existing unique index on Name and Type
            migrationBuilder.DropIndex(
                name: "IX_Categories_Name_Type",
                table: "Categories");

            // Create unique index for parent categories (ParentCategoryId is null)
            migrationBuilder.CreateIndex(
                name: "IX_Categories_Name_Type_ParentCategoryId_Parents",
                table: "Categories",
                columns: new[] { "Name", "Type", "ParentCategoryId" },
                unique: true,
                filter: "\"ParentCategoryId\" IS NULL");

            // Create unique index for child categories (ParentCategoryId is not null)
            migrationBuilder.CreateIndex(
                name: "IX_Categories_Name_Type_ParentCategoryId_Children",
                table: "Categories",
                columns: new[] { "Name", "Type", "ParentCategoryId" },
                unique: true,
                filter: "\"ParentCategoryId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop the new indexes
            migrationBuilder.DropIndex(
                name: "IX_Categories_Name_Type_ParentCategoryId_Parents",
                table: "Categories");

            migrationBuilder.DropIndex(
                name: "IX_Categories_Name_Type_ParentCategoryId_Children",
                table: "Categories");

            // Recreate the original unique index on Name and Type
            migrationBuilder.CreateIndex(
                name: "IX_Categories_Name_Type",
                table: "Categories",
                columns: new[] { "Name", "Type" },
                unique: true);
        }
    }
}
