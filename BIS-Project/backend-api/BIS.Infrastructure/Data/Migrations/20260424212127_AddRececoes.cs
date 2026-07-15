using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BIS.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRececoes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Rececoes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    LojaId = table.Column<int>(type: "int", nullable: false),
                    OperadorId = table.Column<int>(type: "int", nullable: false),
                    DataRececao = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    DocumentoReferencia = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    NumeroLinhas = table.Column<int>(type: "int", nullable: false),
                    TotalUnidades = table.Column<int>(type: "int", nullable: false),
                    DataSincronizacao = table.Column<DateTime>(type: "datetime(6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rececoes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Rececoes_Lojas_LojaId",
                        column: x => x.LojaId,
                        principalTable: "Lojas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Rececoes_Utilizadores_OperadorId",
                        column: x => x.OperadorId,
                        principalTable: "Utilizadores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "LinhasRececao",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    RececaoId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ProdutoId = table.Column<int>(type: "int", nullable: false),
                    Quantidade = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LinhasRececao", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LinhasRececao_Produtos_ProdutoId",
                        column: x => x.ProdutoId,
                        principalTable: "Produtos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LinhasRececao_Rececoes_RececaoId",
                        column: x => x.RececaoId,
                        principalTable: "Rececoes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_LinhasRececao_ProdutoId",
                table: "LinhasRececao",
                column: "ProdutoId");

            migrationBuilder.CreateIndex(
                name: "IX_LinhasRececao_RececaoId",
                table: "LinhasRececao",
                column: "RececaoId");

            migrationBuilder.CreateIndex(
                name: "IX_Rececoes_DataRececao",
                table: "Rececoes",
                column: "DataRececao");

            migrationBuilder.CreateIndex(
                name: "IX_Rececoes_LojaId",
                table: "Rececoes",
                column: "LojaId");

            migrationBuilder.CreateIndex(
                name: "IX_Rececoes_OperadorId",
                table: "Rececoes",
                column: "OperadorId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LinhasRececao");

            migrationBuilder.DropTable(
                name: "Rececoes");
        }
    }
}
