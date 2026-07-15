using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BIS.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLoteValidadeRececao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DataValidade",
                table: "LinhasRececao",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Lote",
                table: "LinhasRececao",
                type: "varchar(50)",
                maxLength: 50,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_LinhasRececao_DataValidade",
                table: "LinhasRececao",
                column: "DataValidade");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_LinhasRececao_DataValidade",
                table: "LinhasRececao");

            migrationBuilder.DropColumn(
                name: "DataValidade",
                table: "LinhasRececao");

            migrationBuilder.DropColumn(
                name: "Lote",
                table: "LinhasRececao");
        }
    }
}
