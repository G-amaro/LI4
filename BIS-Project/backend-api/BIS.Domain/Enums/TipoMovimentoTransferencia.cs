namespace BIS.Domain.Enums;

/// <summary>
/// Tipo de movimento numa transferência entre lojas.
/// Um ENVIO e uma RECECAO formam um par ligado por TransferenciaEnvioId.
/// </summary>
public enum TipoMovimentoTransferencia
{
    /// <summary>Loja origem retira stock e envia para loja destino.</summary>
    Envio = 0,

    /// <summary>Loja destino regista a chegada e incrementa stock.</summary>
    Rececao = 1
}
