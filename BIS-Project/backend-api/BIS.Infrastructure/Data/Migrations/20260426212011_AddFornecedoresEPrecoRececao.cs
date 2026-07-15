using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BIS.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFornecedoresEPrecoRececao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Transferencias_TipoMovimento_TransferenciaEnvioId",
                table: "Transferencias");

            migrationBuilder.AddColumn<int>(
                name: "FornecedorId",
                table: "Rececoes",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PrecoCusto",
                table: "LinhasRececao",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "Fornecedores",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Nome = table.Column<string>(type: "varchar(150)", maxLength: 150, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Nif = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Telefone = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Email = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Morada = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Observacoes = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Ativo = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    AtualizadoEm = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Fornecedores", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_Transferencias_TipoMovimento_TransferenciaEnvioId",
                table: "Transferencias",
                columns: new[] { "TipoMovimento", "TransferenciaEnvioId" },
                unique: true,
                filter: "`TransferenciaEnvioId` IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Rececoes_FornecedorId",
                table: "Rececoes",
                column: "FornecedorId");

            migrationBuilder.CreateIndex(
                name: "IX_Fornecedores_Ativo",
                table: "Fornecedores",
                column: "Ativo");

            migrationBuilder.CreateIndex(
                name: "IX_Fornecedores_Nif",
                table: "Fornecedores",
                column: "Nif");

            migrationBuilder.CreateIndex(
                name: "IX_Fornecedores_Nome",
                table: "Fornecedores",
                column: "Nome");

            migrationBuilder.AddForeignKey(
                name: "FK_Rececoes_Fornecedores_FornecedorId",
                table: "Rececoes",
                column: "FornecedorId",
                principalTable: "Fornecedores",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Rececoes_Fornecedores_FornecedorId",
                table: "Rececoes");

            migrationBuilder.DropTable(
                name: "Fornecedores");

            migrationBuilder.DropIndex(
                name: "IX_Transferencias_TipoMovimento_TransferenciaEnvioId",
                table: "Transferencias");

            migrationBuilder.DropIndex(
                name: "IX_Rececoes_FornecedorId",
                table: "Rececoes");

            migrationBuilder.DropColumn(
                name: "FornecedorId",
                table: "Rececoes");

            migrationBuilder.DropColumn(
                name: "PrecoCusto",
                table: "LinhasRececao");

            migrationBuilder.CreateIndex(
                name: "IX_Transferencias_TipoMovimento_TransferenciaEnvioId",
                table: "Transferencias",
                columns: new[] { "TipoMovimento", "TransferenciaEnvioId" },
                unique: true,
                filter: "[TransferenciaEnvioId] IS NOT NULL");
        }
    }
}
