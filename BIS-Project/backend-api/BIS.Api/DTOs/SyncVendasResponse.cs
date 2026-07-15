namespace BIS.Api.DTOs;

/// <summary>
/// Resposta detalhada do endpoint de sincronização.
/// O POS usa este payload para marcar localmente quais os Guids
/// que foram aceites ou já existiam, e remover da fila de pendentes.
/// </summary>
public class SyncVendasResponse
{
    /// <summary>Timestamp UTC de quando a Sede processou o batch.</summary>
    public DateTime ProcessadoEm { get; set; }

    /// <summary>Total de vendas recebidas no batch.</summary>
    public int TotalRecebidas { get; set; }

    /// <summary>Vendas inseridas pela primeira vez na Sede.</summary>
    public int TotalInseridas { get; set; }

    /// <summary>
    /// Vendas ignoradas porque o Guid já existia na BD central
    /// (envio duplicado — acontece quando a rede cai após persistência mas antes do ACK).
    /// </summary>
    public int TotalDuplicadas { get; set; }

    /// <summary>
    /// Guids que falharam validação de negócio (ex: LojaId inválida, ProdutoId inexistente).
    /// O POS deve registar estes erros para revisão manual.
    /// </summary>
    public List<SyncItemErro> Erros { get; set; } = new();

    public bool Sucesso => !Erros.Any();
}

/// <summary>Detalhe de uma venda que falhou validação.</summary>
public class SyncItemErro
{
    public Guid   VendaId { get; set; }
    public string Motivo  { get; set; } = string.Empty;
}
