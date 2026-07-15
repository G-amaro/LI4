using BIS.Domain.Entities;
using BIS.Domain.Enums;
using BCrypt.Net;

namespace BIS.Infrastructure.Data;

/// <summary>
/// Seed idempotente invocado no arranque do BIS.Api em ambiente de desenvolvimento.
///
/// Estrutura:
///   - 4 Lojas: Sede (TemPOS=false), Fraião, Centro, Gualtar (TemPOS=true)
///   - 1 Administrador + 3 Operadores (1 por loja POS)
///   - Produtos representativos por categoria
/// </summary>
public static class DataSeeder
{
    public const string DemoAdminPassword = "admin123";
    public const string DemoAdminPin      = "1234";
    public const string DemoOperadorPin   = "0000";

    public static async Task SeedAsync(ApplicationDbContext db)
    {
        await SeedLojasAsync(db);
        await SeedUtilizadoresAsync(db);
        await SeedProdutosAsync(db);
    }

    // ─────────────────────────────────────────────────────────────
    private static async Task SeedLojasAsync(ApplicationDbContext db)
    {
        if (db.Lojas.Any()) return;

        db.Lojas.AddRange(
            // Sede — unidade administrativa, SEM POS
            new Loja
            {
                Nome       = "Sede",
                Localidade = "Braga",
                EstadoRede = EstadoRede.Online,
                TemPOS     = false    // não aparece em selectors POS
            },
            // Lojas operacionais — COM POS
            new Loja
            {
                Nome       = "Fraião",
                Localidade = "Braga - Fraião",
                EstadoRede = EstadoRede.Offline,
                TemPOS     = true
            },
            new Loja
            {
                Nome       = "Centro",
                Localidade = "Braga - Centro",
                EstadoRede = EstadoRede.Offline,
                TemPOS     = true
            },
            new Loja
            {
                Nome       = "Gualtar",
                Localidade = "Braga - Gualtar",
                EstadoRede = EstadoRede.Offline,
                TemPOS     = true
            }
        );
        await db.SaveChangesAsync();
    }

    // ─────────────────────────────────────────────────────────────
    private static async Task SeedUtilizadoresAsync(ApplicationDbContext db)
    {
        if (db.Utilizadores.Any()) return;

        var sede    = db.Lojas.First(l => l.Nome == "Sede");
        var fraiao  = db.Lojas.First(l => l.Nome == "Fraião");
        var centro  = db.Lojas.First(l => l.Nome == "Centro");
        var gualtar = db.Lojas.First(l => l.Nome == "Gualtar");

        db.Utilizadores.AddRange(
            new Utilizador
            {
                LojaBaseId   = sede.Id,
                Nome         = "Orlando Ferreira",
                NIF          = "212345670",
                Email        = "orlando@bragaconvenience.pt",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(DemoAdminPassword),
                PinPOS       = BCrypt.Net.BCrypt.HashPassword(DemoAdminPin),
                Perfil       = PerfilUtilizador.Administrador,
                EstadoConta  = EstadoConta.Ativo
            },
            new Utilizador
            {
                LojaBaseId   = fraiao.Id,
                Nome         = "João Sousa",
                NIF          = "223456781",
                Email        = null,
                PasswordHash = null,
                PinPOS       = BCrypt.Net.BCrypt.HashPassword(DemoOperadorPin),
                Perfil       = PerfilUtilizador.Funcionario,
                EstadoConta  = EstadoConta.Ativo
            },
            new Utilizador
            {
                LojaBaseId   = centro.Id,
                Nome         = "Carlos Mendes",
                NIF          = "234567892",
                Email        = null,
                PasswordHash = null,
                PinPOS       = BCrypt.Net.BCrypt.HashPassword(DemoOperadorPin),
                Perfil       = PerfilUtilizador.Funcionario,
                EstadoConta  = EstadoConta.Ativo
            },
            new Utilizador
            {
                LojaBaseId   = gualtar.Id,
                Nome         = "Maria Silva",
                NIF          = "245678904",
                Email        = null,
                PasswordHash = null,
                PinPOS       = BCrypt.Net.BCrypt.HashPassword(DemoOperadorPin),
                Perfil       = PerfilUtilizador.Funcionario,
                EstadoConta  = EstadoConta.Ativo
            }
        );
        await db.SaveChangesAsync();
    }

    // ─────────────────────────────────────────────────────────────
    private static async Task SeedProdutosAsync(ApplicationDbContext db)
    {
        if (db.Produtos.Any()) return;

        db.Produtos.AddRange(
            // Lacticínios
            new Produto { EAN = "5601010010019", Artigo = "Leite Mimosa Meio-Gordo 1L",    Categoria = "Lacticínios", PrecoCusto = 0.65m, PVP = 0.95m, Perecivel = true  },
            new Produto { EAN = "5600618001017", Artigo = "Leite Agros Gordo 1L",           Categoria = "Lacticínios", PrecoCusto = 0.60m, PVP = 0.89m, Perecivel = true  },
            new Produto { EAN = "5601006099001", Artigo = "Queijo Flamengo Fatiado 150g",   Categoria = "Lacticínios", PrecoCusto = 1.80m, PVP = 2.99m, Perecivel = true  },
            new Produto { EAN = "5601006112007", Artigo = "Iogurte Natural Danone 125g",    Categoria = "Lacticínios", PrecoCusto = 0.35m, PVP = 0.59m, Perecivel = true  },
            // Bebidas
            new Produto { EAN = "5449000000996", Artigo = "Coca-Cola 33cl Lata",            Categoria = "Bebidas",     PrecoCusto = 0.45m, PVP = 0.89m, Perecivel = false },
            new Produto { EAN = "5601234567890", Artigo = "Água Luso 1,5L",                 Categoria = "Bebidas",     PrecoCusto = 0.32m, PVP = 0.69m, Perecivel = false },
            new Produto { EAN = "5601235001001", Artigo = "Sumol Laranja 33cl",              Categoria = "Bebidas",     PrecoCusto = 0.50m, PVP = 0.99m, Perecivel = false },
            new Produto { EAN = "5601236001002", Artigo = "Compal Pêssego 33cl",             Categoria = "Bebidas",     PrecoCusto = 0.55m, PVP = 1.09m, Perecivel = false },
            // Padaria
            new Produto { EAN = "5601009876543", Artigo = "Pão de Água",                    Categoria = "Padaria",     PrecoCusto = 0.08m, PVP = 0.15m, Perecivel = true  },
            new Produto { EAN = "5601009001234", Artigo = "Croissant Manteiga",              Categoria = "Padaria",     PrecoCusto = 0.25m, PVP = 0.49m, Perecivel = true  },
            // Snacks
            new Produto { EAN = "5601240001001", Artigo = "Pringles Original 165g",         Categoria = "Snacks",      PrecoCusto = 1.20m, PVP = 2.49m, Perecivel = false },
            new Produto { EAN = "5601241002002", Artigo = "Ruffles Queijo 100g",             Categoria = "Snacks",      PrecoCusto = 0.65m, PVP = 1.39m, Perecivel = false },
            new Produto { EAN = "5601242003003", Artigo = "Oreo Original 176g",              Categoria = "Snacks",      PrecoCusto = 1.10m, PVP = 2.19m, Perecivel = false },
            // Limpeza
            new Produto { EAN = "5601300001001", Artigo = "Fairy Original 500ml",            Categoria = "Limpeza",     PrecoCusto = 1.20m, PVP = 2.49m, Perecivel = false },
            new Produto { EAN = "5601301002002", Artigo = "Skip Pó 3 em 1 40 doses",        Categoria = "Limpeza",     PrecoCusto = 5.50m, PVP = 9.99m, Perecivel = false },
            // Higiene
            new Produto { EAN = "5601400001001", Artigo = "Dove Shower Gel 250ml",           Categoria = "Higiene",     PrecoCusto = 1.50m, PVP = 2.99m, Perecivel = false },
            new Produto { EAN = "5601401002002", Artigo = "Colgate Total 75ml",              Categoria = "Higiene",     PrecoCusto = 1.10m, PVP = 2.29m, Perecivel = false }
        );
        await db.SaveChangesAsync();
    }
}
