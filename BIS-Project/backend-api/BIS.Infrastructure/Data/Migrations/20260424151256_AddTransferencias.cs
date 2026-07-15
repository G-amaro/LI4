using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BIS.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTransferencias : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Transferencias",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    TipoMovimento = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    LojaOrigemId = table.Column<int>(type: "int", nullable: false),
                    LojaDestinoId = table.Column<int>(type: "int", nullable: false),
                    OperadorId = table.Column<int>(type: "int", nullable: false),
                    DataMovimento = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    TransferenciaEnvioId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    DocumentoReferencia = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Observacoes = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    NumeroLinhas = table.Column<int>(type: "int", nullable: false),
                    TotalUnidades = table.Column<int>(type: "int", nullable: false),
                    DataSincronizacao = table.Column<DateTime>(type: "datetime(6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Transferencias", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Transferencias_Lojas_LojaDestinoId",
                        column: x => x.LojaDestinoId,
                        principalTable: "Lojas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Transferencias_Lojas_LojaOrigemId",
                        column: x => x.LojaOrigemId,
                        principalTable: "Lojas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Transferencias_Transferencias_TransferenciaEnvioId",
                        column: x => x.TransferenciaEnvioId,
                        principalTable: "Transferencias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Transferencias_Utilizadores_OperadorId",
                        column: x => x.OperadorId,
                        principalTable: "Utilizadores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "LinhasTransferencia",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    TransferenciaId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ProdutoId = table.Column<int>(type: "int", nullable: false),
                    Quantidade = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LinhasTransferencia", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LinhasTransferencia_Produtos_ProdutoId",
                        column: x => x.ProdutoId,
                        principalTable: "Produtos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LinhasTransferencia_Transferencias_TransferenciaId",
                        column: x => x.TransferenciaId,
                        principalTable: "Transferencias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_LinhasTransferencia_ProdutoId",
                table: "LinhasTransferencia",
                column: "ProdutoId");

            migrationBuilder.CreateIndex(
                name: "IX_LinhasTransferencia_TransferenciaId",
                table: "LinhasTransferencia",
                column: "TransferenciaId");

            migrationBuilder.CreateIndex(
                name: "IX_Transferencias_DataMovimento",
                table: "Transferencias",
                column: "DataMovimento");

            migrationBuilder.CreateIndex(
                name: "IX_Transferencias_LojaDestinoId",
                table: "Transferencias",
                column: "LojaDestinoId");

            migrationBuilder.CreateIndex(
                name: "IX_Transferencias_LojaOrigemId",
                table: "Transferencias",
                column: "LojaOrigemId");

            migrationBuilder.CreateIndex(
                name: "IX_Transferencias_OperadorId",
                table: "Transferencias",
                column: "OperadorId");

            migrationBuilder.CreateIndex(
                name: "IX_Transferencias_TipoMovimento_TransferenciaEnvioId",
                table: "Transferencias",
                columns: new[] { "TipoMovimento", "TransferenciaEnvioId" },
                unique: true,
                filter: "[TransferenciaEnvioId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Transferencias_TransferenciaEnvioId",
                table: "Transferencias",
                column: "TransferenciaEnvioId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LinhasTransferencia");

            migrationBuilder.DropTable(
                name: "Transferencias");
        }
    }
}
