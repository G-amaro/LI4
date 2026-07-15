namespace BIS.Api.DTOs;

/// <summary>
/// Card resumido de uma loja para a listagem principal.
/// </summary>
public class LojaCardDto
{
    public int       Id                    { get; set; }
    public string    Nome                  { get; set; } = string.Empty;
    public string?   Localidade            { get; set; }
    public bool      IsSede                { get; set; }

    public int       NumeroOperadores      { get; set; }
    public int       NumeroProdutosCatalogo { get; set; }
    public decimal   VendasHoje            { get; set; }
    public int       TransacoesHoje        { get; set; }
    public DateTime? UltimaSincronizacao   { get; set; }

    public int       ProdutosEmAlerta      { get; set; }
    public int       ProdutosCriticos      { get; set; }
}

/// <summary>
/// Detalhe completo de uma loja (página /lojas/:id).
/// </summary>
public class LojaDetalheDto
{
    public int       Id                  { get; set; }
    public string    Nome                { get; set; } = string.Empty;
    public string?   Localidade          { get; set; }
    public bool      IsSede              { get; set; }
    public DateTime? UltimaSincronizacao { get; set; }

    public LojaKpisDto                     Kpis           { get; set; } = new();
    public List<LojaOperadorDto>           Operadores     { get; set; } = new();
    public List<LojaTopProdutoDto>         TopProdutos    { get; set; } = new();
    public List<LojaStockCriticoDto>       StockCritico   { get; set; } = new();
    public List<LojaActividadeDiariaDto>   Actividade7Dias { get; set; } = new();
}

public class LojaKpisDto
{
    public decimal VendasHoje      { get; set; }
    public int     TransacoesHoje  { get; set; }
    public decimal VendasSemana    { get; set; }
    public int     TransacoesSemana { get; set; }
    public decimal TicketMedio     { get; set; }
    public int     UnidadesVendidas7d { get; set; }
    public int     QuebrasUltimos7d   { get; set; }
}

public class LojaOperadorDto
{
    public int       Id            { get; set; }
    public string    Nome          { get; set; } = string.Empty;
    public string    NIF           { get; set; } = string.Empty;
    public string    Perfil        { get; set; } = string.Empty;
    public string    EstadoConta   { get; set; } = string.Empty;
    public DateTime? UltimoLogin   { get; set; }
}

public class LojaTopProdutoDto
{
    public int      ProdutoId       { get; set; }
    public string   Artigo          { get; set; } = string.Empty;
    public int      UnidadesVendidas { get; set; }
    public decimal  Receita         { get; set; }
}

public class LojaStockCriticoDto
{
    public int     ProdutoId  { get; set; }
    public string  Artigo     { get; set; } = string.Empty;
    public string  Categoria  { get; set; } = string.Empty;
    public int     Stock      { get; set; }
    public string  Estado     { get; set; } = "Critico";  // 'Critico' | 'Alerta'
}

public class LojaActividadeDiariaDto
{
    public DateTime Dia       { get; set; }
    public decimal  Vendas    { get; set; }
    public int      Transacoes { get; set; }
}
