using BIS.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BIS.Infrastructure.Data;

/// <summary>
/// Contexto EF Core para a Base de Dados Central (MySQL).
///
/// Usa estratégia híbrida de chaves (conforme Capítulo 5 do relatório):
/// - int IDENTITY para catálogo (Loja, Produto, Utilizador, LinhaVenda, Fornecedor)
/// - Guid para entidades transacionais locais (Venda, Quebra, Receção)
///
/// A connection string é injetada via Program.cs, não hard-coded aqui.
/// </summary>
public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    // ─── DbSets ──────────────────────────────────────────────────────────
    public DbSet<Loja>       Lojas        => Set<Loja>();
    public DbSet<Utilizador> Utilizadores => Set<Utilizador>();
    public DbSet<Produto>    Produtos     => Set<Produto>();
    public DbSet<Venda>      Vendas       => Set<Venda>();
    public DbSet<LinhaVenda> LinhasVenda  => Set<LinhaVenda>();
    public DbSet<Quebra>     Quebras      => Set<Quebra>();

    public DbSet<FechoCaixa> FechosCaixa => Set<FechoCaixa>();

    public DbSet<Transferencia>       Transferencias       => Set<Transferencia>();
    public DbSet<LinhaTransferencia>  LinhasTransferencia  => Set<LinhaTransferencia>();

    public DbSet<Devolucao>       Devolucoes      => Set<Devolucao>();
    public DbSet<LinhaDevolucao>  LinhasDevolucao => Set<LinhaDevolucao>();

    public DbSet<Rececao>       Rececoes      => Set<Rececao>();
    public DbSet<LinhaRececao>  LinhasRececao => Set<LinhaRececao>();

    // [+ NOVO] Fase 4 — Fornecedores
    public DbSet<Fornecedor> Fornecedores => Set<Fornecedor>();

    // ─── Fluent API: relações, índices e precisão decimal ────────────────
    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        // ─────── Produto ───────
        b.Entity<Produto>()
            .HasIndex(p => p.EAN)
            .IsUnique();

        b.Entity<Produto>().Property(p => p.PrecoCusto).HasPrecision(10, 2);
        b.Entity<Produto>().Property(p => p.PVP).HasPrecision(10, 2);
        b.Entity<Produto>().Property(p => p.TaxaIVA).HasPrecision(5, 2).HasDefaultValue(23.00m);
        b.Entity<Produto>().Property(p => p.ImagemUrl).HasMaxLength(500).IsRequired(false);

        // ─────── Utilizador ───────
        b.Entity<Utilizador>()
            .HasIndex(u => u.NIF)
            .IsUnique();

        b.Entity<Utilizador>()
            .HasIndex(u => u.Email)
            .IsUnique()
            .HasFilter("Email IS NOT NULL");

        b.Entity<Utilizador>()
            .HasOne(u => u.LojaBase)
            .WithMany(l => l.Utilizadores)
            .HasForeignKey(u => u.LojaBaseId)
            .OnDelete(DeleteBehavior.Restrict);

        // ─────── Venda ───────
        b.Entity<Venda>().Property(v => v.ValorTotal).HasPrecision(10, 2);

        b.Entity<Venda>()
            .HasOne(v => v.Loja)
            .WithMany(l => l.Vendas)
            .HasForeignKey(v => v.LojaId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<Venda>()
            .HasOne(v => v.Operador)
            .WithMany()
            .HasForeignKey(v => v.OperadorId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<Venda>()
            .HasIndex(v => new { v.LojaId, v.DataTransacao });

        b.Entity<Venda>()
            .HasIndex(v => v.DataSincronizacao);

        // ─────── LinhaVenda ───────
        b.Entity<LinhaVenda>().Property(l => l.Quantidade).HasPrecision(10, 3);
        b.Entity<LinhaVenda>().Property(l => l.PrecoUnitario).HasPrecision(10, 2);
        b.Entity<LinhaVenda>().Property(l => l.Subtotal).HasPrecision(10, 2);

        b.Entity<LinhaVenda>()
            .HasOne(l => l.Venda)
            .WithMany(v => v.Linhas)
            .HasForeignKey(l => l.VendaId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<LinhaVenda>()
            .HasOne(l => l.Produto)
            .WithMany()
            .HasForeignKey(l => l.ProdutoId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<LinhaVenda>()
            .HasIndex(l => new { l.VendaId, l.ProdutoId });

        // ─────── Quebra ───────
        b.Entity<Quebra>().Property(q => q.ValorPerdido).HasPrecision(10, 2);

        b.Entity<Quebra>()
            .HasOne(q => q.Loja)
            .WithMany(l => l.Quebras)
            .HasForeignKey(q => q.LojaId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<Quebra>()
            .HasOne(q => q.Operador)
            .WithMany()
            .HasForeignKey(q => q.OperadorId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<Quebra>()
            .HasOne(q => q.Produto)
            .WithMany()
            .HasForeignKey(q => q.ProdutoId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<Quebra>()
            .HasIndex(q => new { q.LojaId, q.DataRegisto });

        // ─────── FechoCaixa ───────
        b.Entity<FechoCaixa>(e =>
        {
            e.HasKey(f => f.Id);
            e.Property(f => f.TeoricoNumerario).HasPrecision(12, 2);
            e.Property(f => f.TeoricoMultibanco).HasPrecision(12, 2);
            e.Property(f => f.TeoricoMbway).HasPrecision(12, 2);
            e.Property(f => f.TeoricoTotal).HasPrecision(12, 2);
            e.Property(f => f.ContadoNumerario).HasPrecision(12, 2);
            e.Property(f => f.ContadoMultibanco).HasPrecision(12, 2);
            e.Property(f => f.ContadoMbway).HasPrecision(12, 2);
            e.Property(f => f.ContadoTotal).HasPrecision(12, 2);
            e.Property(f => f.Discrepancia).HasPrecision(12, 2);

            e.HasOne(f => f.Loja)
                .WithMany(l => l.Fechos)
                .HasForeignKey(f => f.LojaId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(f => f.Operador)
                .WithMany()
                .HasForeignKey(f => f.OperadorId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(f => f.DataFecho);
        });

        // ─────── Transferencia ───────
        b.Entity<Transferencia>(e =>
        {
            e.HasKey(t => t.Id);

            e.Property(t => t.TipoMovimento)
             .HasConversion<string>()
             .HasMaxLength(20);

            e.HasOne(t => t.LojaOrigem)
             .WithMany(l => l.TransferenciasEnviadas)
             .HasForeignKey(t => t.LojaOrigemId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(t => t.LojaDestino)
             .WithMany(l => l.TransferenciasRecebidas)
             .HasForeignKey(t => t.LojaDestinoId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(t => t.Operador)
             .WithMany()
             .HasForeignKey(t => t.OperadorId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(t => t.Envio)
             .WithMany()
             .HasForeignKey(t => t.TransferenciaEnvioId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(t => new { t.TipoMovimento, t.TransferenciaEnvioId })
             .IsUnique()
             .HasFilter("`TransferenciaEnvioId` IS NOT NULL");

            e.HasIndex(t => t.LojaDestinoId);
            e.HasIndex(t => t.DataMovimento);
        });

        b.Entity<LinhaTransferencia>(e =>
        {
            e.HasKey(l => l.Id);

            e.HasOne(l => l.Transferencia)
             .WithMany(t => t.Linhas)
             .HasForeignKey(l => l.TransferenciaId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(l => l.Produto)
             .WithMany()
             .HasForeignKey(l => l.ProdutoId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ─────── Devolucao ───────
        b.Entity<Devolucao>(e =>
        {
            e.HasKey(d => d.Id);

            e.Property(d => d.ValorReembolsado)
             .HasPrecision(10, 2);

            e.HasOne(d => d.VendaOriginal)
             .WithMany()
             .HasForeignKey(d => d.VendaOriginalId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(d => d.Loja)
             .WithMany()
             .HasForeignKey(d => d.LojaId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(d => d.Operador)
             .WithMany()
             .HasForeignKey(d => d.OperadorId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(d => d.LojaId);
            e.HasIndex(d => d.DataDevolucao);
            e.HasIndex(d => d.VendaOriginalId);
        });

        b.Entity<LinhaDevolucao>(e =>
        {
            e.HasKey(l => l.Id);

            e.Property(l => l.PrecoUnitario).HasPrecision(10, 2);
            e.Property(l => l.Subtotal).HasPrecision(10, 2);

            e.HasOne(l => l.Devolucao)
             .WithMany(d => d.Linhas)
             .HasForeignKey(l => l.DevolucaoId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(l => l.Produto)
             .WithMany()
             .HasForeignKey(l => l.ProdutoId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ─────── Rececao ───────
        b.Entity<Rececao>(e =>
        {
            e.HasKey(r => r.Id);

            e.HasOne(r => r.Loja)
             .WithMany()
             .HasForeignKey(r => r.LojaId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(r => r.Operador)
             .WithMany()
             .HasForeignKey(r => r.OperadorId)
             .OnDelete(DeleteBehavior.Restrict);

            // [+ NOVO] FK para Fornecedor — opcional, SetNull se fornecedor for apagado
            e.HasOne(r => r.Fornecedor)
             .WithMany(f => f.Rececoes)
             .HasForeignKey(r => r.FornecedorId)
             .OnDelete(DeleteBehavior.SetNull);

            e.HasIndex(r => r.LojaId);
            e.HasIndex(r => r.DataRececao);
            e.HasIndex(r => r.FornecedorId);   // [+ NOVO]
        });

        b.Entity<LinhaRececao>(e =>
        {
            e.HasKey(l => l.Id);

            e.HasOne(l => l.Rececao)
             .WithMany(r => r.Linhas)
             .HasForeignKey(l => l.RececaoId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(l => l.Produto)
             .WithMany()
             .HasForeignKey(l => l.ProdutoId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(l => l.DataValidade);

            // [+ NOVO] precisão decimal para PrecoCusto
            e.Property(l => l.PrecoCusto).HasPrecision(10, 2);
        });

        // ─────── Fornecedor ─── [+ NOVO]
        b.Entity<Fornecedor>(e =>
        {
            e.HasKey(f => f.Id);

            e.Property(f => f.Nome).IsRequired();

            e.HasIndex(f => f.Nome);
            e.HasIndex(f => f.Nif);   // não-único: NIF pode ser nulo, e duplicados serão tratados na app

            e.HasIndex(f => f.Ativo); // queries comuns: "fornecedores activos"
        });
    }
}
