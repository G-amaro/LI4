using BIS.Domain.Entities;
using BIS.Domain.Enums;
using BIS.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using System.Security.Claims;
namespace BIS.Tests;

public abstract class BisTestBase : IDisposable
{
    protected readonly ApplicationDbContext Db;
   

    protected const int LojaId     = 1;
    protected const int OperadorId = 1;
    protected const int ProdutoId  = 1;

    protected BisTestBase()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
    .UseInMemoryDatabase(Guid.NewGuid().ToString()).ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
    .Options;
    Db = new ApplicationDbContext(options);
        SeedDadosMinimos();
    }

    private void SeedDadosMinimos()
    {
        Db.Lojas.Add(new Loja
        {
            Id = LojaId, Nome = "Fraião",
            Localidade = "Braga", TemPOS = true
        });
        Db.Utilizadores.Add(new Utilizador
        {
            Id = OperadorId, Nome = "João Sousa",
            NIF = "223456781", PinPOS = "hash",
            Perfil = PerfilUtilizador.Funcionario,
            LojaBaseId = LojaId,
            EstadoConta = EstadoConta.Ativo
        });
        Db.Produtos.Add(new Produto
        {
            Id = ProdutoId, EAN = "5601234567890",
            Artigo = "Água Luso 1,5L", Categoria = "Bebidas",
            PrecoCusto = 0.32m, PVP = 0.69m, Perecivel = false
        });
        Db.SaveChanges();
    }

    protected static ControllerContext CriarContextoAutenticado(
        PerfilUtilizador perfil = PerfilUtilizador.Administrador,
        int lojaId = LojaId)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, OperadorId.ToString()),
            new(ClaimTypes.Role, perfil.ToString()),
            new("loja_id", lojaId.ToString())
        };
        var identidade = new ClaimsIdentity(claims, "TestAuth");
        var principal  = new ClaimsPrincipal(identidade);
        return new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };
    }

    public void Dispose()
    {
        Db.Dispose();
    }
}
