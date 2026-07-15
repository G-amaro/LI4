namespace BIS.Api.DTOs;

/// <summary>
/// Resposta consolidada da página de Inventário.
/// </summary>
public class InventarioConsolidadoDto
{
    public List<InventarioLojaDto>          Lojas      { get; set; } = new();
    public List<InventarioArtigoDto>        Artigos    { get; set; } = new();
    public InventarioKpisDto                Kpis       { get; set; } = new();
    public Dictionary<int, DateTime?>       SyncStatus { get; set; } = new();
    public DateTime                          GeradoEm   { get; set; }
}

public class InventarioLojaDto
{
    public int    Id   { get; set; }
    public string Nome { get; set; } = string.Empty;
}

public class InventarioArtigoDto
{
    public int    Id            { get; set; }
    public string EAN           { get; set; } = string.Empty;
    public string Artigo        { get; set; } = string.Empty;
    public string Categoria     { get; set; } = string.Empty;
    public int    Total         { get; set; }
    public int    MinimoGlobal  { get; set; }

    /// <summary>'Critico' | 'Alerta' | 'OK'.</summary>
    public string Estado        { get; set; } = "OK";

    /// <summary>Mapa lojaId → quantidade em stock.</summary>
    public Dictionary<int, int> StockPorLoja { get; set; } = new();
}

public class InventarioKpisDto
{
    public int TotalArtigos { get; set; }
    public int Criticos     { get; set; }
    public int Alertas      { get; set; }
    public int Ok           { get; set; }
}
