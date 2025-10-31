using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace spending_tracker_api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveIsDefaultFromScenario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsDefault",
                table: "Scenarios");

            migrationBuilder.UpdateData(
                table: "Scenarios",
                keyColumn: "ScenarioId",
                keyValue: 1,
                columns: new[] { "Description", "Name" },
                values: new object[] { "Initial planning scenario", "Base Scenario" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsDefault",
                table: "Scenarios",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.UpdateData(
                table: "Scenarios",
                keyColumn: "ScenarioId",
                keyValue: 1,
                columns: new[] { "Description", "IsDefault", "Name" },
                values: new object[] { "Default planning scenario", true, "Default" });
        }
    }
}
