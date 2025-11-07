using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace spending_tracker_api.Migrations
{
    /// <inheritdoc />
    public partial class FixDuplicateConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Categories_Name_Type",
                table: "Categories");

            migrationBuilder.CreateIndex(
                name: "IX_Categories_Name_Type_ParentCategoryId_Parents",
                table: "Categories",
                columns: new[] { "Name", "Type", "ParentCategoryId" },
                unique: true,
                filter: "\"ParentCategoryId\" IS NULL");

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
            migrationBuilder.DropIndex(
                name: "IX_Categories_Name_Type_ParentCategoryId_Parents",
                table: "Categories");

            migrationBuilder.DropIndex(
                name: "IX_Categories_Name_Type_ParentCategoryId_Children",
                table: "Categories");

            migrationBuilder.CreateIndex(
                name: "IX_Categories_Name_Type",
                table: "Categories",
                columns: new[] { "Name", "Type" },
                unique: true);
        }
    }
}
