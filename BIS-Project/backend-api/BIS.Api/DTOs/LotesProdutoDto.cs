namespace BIS.Api.DTOs;

/// <summary>
/// Resposta do endpoint GET /api/inventario/lotes/{produtoId}.
/// Histórico de recepções com lote e validade (Opção A: detalhado, não agregado).
/// </summary>
public class LotesProdutoDto
{
    public int     ProdutoId       { get; set; }
    public string  EAN             { get; set; } = string.Empty;
    public string  Artigo          { get; set; } = string.Empty;
    public string  Categoria       { get; set; } = string.Empty;
    public bool    Perecivel       { get; set; }

    public List<RecepcaoLoteDto> Recepcoes { get; set; } = new();

    public int     TotalRecebido   { get; set; }
    public int     NumRecepcoes    { get; set; }
}

public class RecepcaoLoteDto
{
    public Guid     RececaoId     { get; set; }
    public DateTime DataRececao   { get; set; }
    public string?  Lote          { get; set; }
    public DateTime? DataValidade { get; set; }
    public int      Quantidade    { get; set; }

    public int      LojaId        { get; set; }
    public string   LojaNome      { get; set; } = string.Empty;

    public string?  Documento     { get; set; }
    public string?  OperadorNome  { get; set; }

    /// <summary>'Vencido' | 'Critico' | 'Alerta' | 'OK' | 'SemValidade'.</summary>
    public string   EstadoValidade { get; set; } = "SemValidade";

    /// <summary>Dias até expirar (negativo se já vencido). null se sem validade.</summary>
    public int?     DiasAteExpirar { get; set; }
}
