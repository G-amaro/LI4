namespace BIS.Api.DTOs;

/// <summary>
/// Linha de inventário unificado — 1 produto com stock distribuído por 3 lojas.
/// Consumido pelo Backoffice Web no ecrã de Inventário.
///
/// Nota: no MVP os valores de stock são gerados deterministicamente a partir
/// do ID do produto (mock estável). Quando a entidade StockPorLoja for
/// implementada na Sede (actualmente só existe localmente no POS), o
/// InventarioController passa a ler valores reais sem alterar este DTO.
/// </summary>
public class InventarioDto
{
    /// <summary>Código de barras EAN — campo "REF" no ecrã.</summary>
    public string Ref       { get; set; } = string.Empty;
    public string Artigo    { get; set; } = string.Empty;
    public string Categoria { get; set; } = string.Empty;

    /// <summary>Soma de stock em todas as lojas.</summary>
    public int Total        { get; set; }

    // Stock por loja — ordenado por ID (1, 2, 3)
    public int StockFraiao  { get; set; }
    public int StockCentro  { get; set; }
    public int StockGualtar { get; set; }

    /// <summary>"Critico" (sem stock) | "Alerta" (stock baixo) | "OK"</summary>
    public string Estado    { get; set; } = "OK";
}

/// <summary>
/// Resposta do endpoint GET /api/inventario — inclui linhas + agregados
/// para que o frontend não precise de recalcular os KPIs.
/// </summary>
public class InventarioResponse
{
    public List<InventarioDto> Itens { get; set; } = new();

    public int TotalArtigos { get; set; }
    public int TotalCritico { get; set; }
    public int TotalAlerta  { get; set; }
    public int TotalOk      { get; set; }
}
