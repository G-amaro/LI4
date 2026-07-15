namespace BIS.Api.DTOs;

/// <summary>
/// KPIs agregados para o topo da página Relatórios Financeiros.
/// Valores em euros (positivos). Discrepância negativa é representada
/// pelo sinal do campo TotalDiscrepancias (pode ser negativo).
/// </summary>
public class ResumoFinanceiroDto
{
    /// <summary>Soma das discrepâncias dos fechos de caixa (pode ser negativo).</summary>
    public decimal TotalDiscrepancias { get; set; }

    /// <summary>Soma do valor perdido em quebras (sempre positivo).</summary>
    public decimal TotalQuebras { get; set; }

    public int NumeroFechos  { get; set; }
    public int NumeroQuebras { get; set; }
}

/// <summary>
/// Linha da tabela "Auditoria de fechos de caixa".
/// </summary>
public class FechoCaixaDto
{
    public string  Data               { get; set; } = string.Empty;   // "DD/MM/YYYY"
    public string  Loja               { get; set; } = string.Empty;
    public string  OperadorTurno      { get; set; } = string.Empty;   // "João Silva (T1)"
    public decimal ValorTeorico       { get; set; }
    public decimal ValorDeclarado     { get; set; }
    public decimal Discrepancia       { get; set; }                   // declarado - teórico
}

/// <summary>
/// Linha da tabela "Relatório de quebras".
/// </summary>
public class QuebraRelatorioDto
{
    public string  Data           { get; set; } = string.Empty;       // "DD/MM/YYYY"
    public string  Loja           { get; set; } = string.Empty;
    public string  Artigo         { get; set; } = string.Empty;
    public int     Quantidade     { get; set; }
    public decimal PrecoCusto     { get; set; }                       // custo unitário
    public decimal PerdaTotal     { get; set; }                       // precoCusto × qtd
    public string  Motivo         { get; set; } = string.Empty;       // "Furto" | "Dano Físico" | "Validade"
    public string  OperadorTurno  { get; set; } = string.Empty;
}
