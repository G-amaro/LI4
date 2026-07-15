namespace BIS.Api.DTOs;

/// <summary>
/// Dados agregados para o Dashboard Executivo (UC12).
/// Consumido pelo Backoffice Web da Sede.
/// </summary>
public class DashboardDto
{
    /// <summary>Receita total acumulada (soma de todas as vendas sincronizadas).</summary>
    public decimal TotalVendas { get; set; }

    /// <summary>Impacto financeiro total das quebras (preço de custo × quantidade).</summary>
    public decimal TotalQuebras { get; set; }

    /// <summary>Soma das discrepâncias absolutas de fechos de caixa.</summary>
    public decimal TotalDiscrepancias { get; set; }

    /// <summary>Contadores de entidades sincronizadas.</summary>
    public int NumeroLojas       { get; set; }
    public int NumeroProdutos    { get; set; }
    public int NumeroOperadores  { get; set; }

    /// <summary>Série temporal de vendas dos últimos 7 dias.</summary>
    public List<VendasDiariasDto> VendasPorDia { get; set; } = new();

    /// <summary>Top 5 lojas por receita acumulada.</summary>
    public List<LojaResumoDto> TopLojas { get; set; } = new();
}

public class VendasDiariasDto
{
    public string  Data  { get; set; } = string.Empty;  // formato "YYYY-MM-DD"
    public decimal Valor { get; set; }
    public int     NumeroVendas { get; set; }
}

public class LojaResumoDto
{
    public int     Id     { get; set; }
    public string  Nome   { get; set; } = string.Empty;
    public decimal Receita { get; set; }
    public int     NumeroVendas { get; set; }
}
