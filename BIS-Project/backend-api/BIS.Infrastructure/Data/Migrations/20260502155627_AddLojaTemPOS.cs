using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BIS.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLojaTemPOS : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "TemPOS",
                table: "Lojas",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TemPOS",
                table: "Lojas");
        }
    }
}
