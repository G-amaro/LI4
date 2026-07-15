namespace BIS.Api.DTOs;

/// <summary>
/// Linha do relatório — uma transferência conceptual (envio + opcional recepção).
/// Usado na listagem agregada do backoffice.
/// </summary>
public class TransferenciaRelatorioDto
{
    public Guid     EnvioId             { get; set; }
    public DateTime DataEnvio           { get; set; }

    public int      LojaOrigemId        { get; set; }
    public string   LojaOrigemNome      { get; set; } = string.Empty;
    public int      LojaDestinoId       { get; set; }
    public string   LojaDestinoNome     { get; set; } = string.Empty;

    public string?  DocumentoReferencia { get; set; }
    public int      NumeroLinhas        { get; set; }
    public int      UnidadesEnviadas    { get; set; }

    /// <summary>'EmTransito' | 'Recebida' | 'Divergencia'.</summary>
    public string   Status              { get; set; } = "EmTransito";

    public Guid?    RececaoId           { get; set; }
    public DateTime? DataRececao        { get; set; }
    public int?     UnidadesRecebidas   { get; set; }

    /// <summary>Diferença = Enviadas - Recebidas (sempre >= 0 se recebida).</summary>
    public int      DiferencaUnidades   { get; set; }
}

/// <summary>
/// Indicadores agregados para o cabeçalho da página.
/// </summary>
public class TransferenciasKpisDto
{
    public int Total            { get; set; }
    public int EmTransito       { get; set; }
    public int Recebidas        { get; set; }
    public int ComDivergencia   { get; set; }
    public int UnidadesTotais   { get; set; }
}

/// <summary>
/// Detalhe completo de uma transferência (envio + recepção + linhas).
/// Usado no modal de detalhe.
/// </summary>
public class TransferenciaDetalheDto
{
    public Guid     EnvioId             { get; set; }
    public DateTime DataEnvio           { get; set; }
    public string   LojaOrigemNome      { get; set; } = string.Empty;
    public string   LojaDestinoNome     { get; set; } = string.Empty;
    public string?  OperadorEnvioNome   { get; set; }
    public string?  DocumentoReferencia { get; set; }
    public string?  ObservacoesEnvio    { get; set; }

    public Guid?    RececaoId           { get; set; }
    public DateTime? DataRececao        { get; set; }
    public string?  OperadorRececaoNome { get; set; }
    public string?  ObservacoesRececao  { get; set; }

    public string   Status              { get; set; } = "EmTransito";

    public List<TransferenciaLinhaComparativaDto> Linhas { get; set; } = new();
}

/// <summary>
/// Linha do detalhe — mostra lado a lado quantidade enviada vs recebida.
/// </summary>
public class TransferenciaLinhaComparativaDto
{
    public int     ProdutoId          { get; set; }
    public string  EAN                { get; set; } = string.Empty;
    public string  Artigo             { get; set; } = string.Empty;
    public string  Categoria          { get; set; } = string.Empty;
    public int     QuantidadeEnviada  { get; set; }
    public int?    QuantidadeRecebida { get; set; }
    public int     Diferenca          { get; set; }
}
