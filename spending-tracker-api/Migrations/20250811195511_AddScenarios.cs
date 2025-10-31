using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace spending_tracker_api.Migrations
{
    /// <inheritdoc />
    public partial class AddScenarios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PlanningBudgets_CategoryId_Year",
                table: "PlanningBudgets");

            migrationBuilder.AddColumn<int>(
                name: "ScenarioId",
                table: "PlanningBudgets",
                type: "INTEGER",
                nullable: false,
                defaultValue: 1); // Set default to 1 instead of 0

            migrationBuilder.CreateTable(
                name: "Scenarios",
                columns: table => new
                {
                    ScenarioId = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    IsDefault = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Scenarios", x => x.ScenarioId);
                });

            migrationBuilder.InsertData(
                table: "Scenarios",
                columns: new[] { "ScenarioId", "CreatedAt", "Description", "IsDefault", "Name", "UpdatedAt" },
                values: new object[] { 1, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Default planning scenario", true, "Default", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) });

            // Update any existing PlanningBudget records with ScenarioId = 0 to use ScenarioId = 1
            migrationBuilder.Sql("UPDATE PlanningBudgets SET ScenarioId = 1 WHERE ScenarioId = 0;");

            migrationBuilder.CreateIndex(
                name: "IX_PlanningBudgets_CategoryId_ScenarioId_Year",
                table: "PlanningBudgets",
                columns: new[] { "CategoryId", "ScenarioId", "Year" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlanningBudgets_ScenarioId",
                table: "PlanningBudgets",
                column: "ScenarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Scenarios_Name",
                table: "Scenarios",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_PlanningBudgets_Scenarios_ScenarioId",
                table: "PlanningBudgets",
                column: "ScenarioId",
                principalTable: "Scenarios",
                principalColumn: "ScenarioId",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PlanningBudgets_Scenarios_ScenarioId",
                table: "PlanningBudgets");

            migrationBuilder.DropTable(
                name: "Scenarios");

            migrationBuilder.DropIndex(
                name: "IX_PlanningBudgets_CategoryId_ScenarioId_Year",
                table: "PlanningBudgets");

            migrationBuilder.DropIndex(
                name: "IX_PlanningBudgets_ScenarioId",
                table: "PlanningBudgets");

            migrationBuilder.DropColumn(
                name: "ScenarioId",
                table: "PlanningBudgets");

            migrationBuilder.CreateIndex(
                name: "IX_PlanningBudgets_CategoryId_Year",
                table: "PlanningBudgets",
                columns: new[] { "CategoryId", "Year" },
                unique: true);
        }
    }
}
