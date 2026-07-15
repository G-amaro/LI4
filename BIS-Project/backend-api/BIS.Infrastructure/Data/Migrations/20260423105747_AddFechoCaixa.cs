using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BIS.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFechoCaixa : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FechosCaixa",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    LojaId = table.Column<int>(type: "int", nullable: false),
                    OperadorId = table.Column<int>(type: "int", nullable: false),
                    DataFecho = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    TeoricoNumerario = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    TeoricoMultibanco = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    TeoricoMbway = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    TeoricoTotal = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    ContadoNumerario = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    ContadoMultibanco = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    ContadoMbway = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    ContadoTotal = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    Discrepancia = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    TemDiscrepancia = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    Justificacao = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DataSincronizacao = table.Column<DateTime>(type: "datetime(6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FechosCaixa", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FechosCaixa_Lojas_LojaId",
                        column: x => x.LojaId,
                        principalTable: "Lojas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FechosCaixa_Utilizadores_OperadorId",
                        column: x => x.OperadorId,
                        principalTable: "Utilizadores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_FechosCaixa_DataFecho",
                table: "FechosCaixa",
                column: "DataFecho");

            migrationBuilder.CreateIndex(
                name: "IX_FechosCaixa_LojaId",
                table: "FechosCaixa",
                column: "LojaId");

            migrationBuilder.CreateIndex(
                name: "IX_FechosCaixa_OperadorId",
                table: "FechosCaixa",
                column: "OperadorId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FechosCaixa");
        }
    }
}
