namespace BIS.Domain.Enums;

/// <summary>
/// Métodos de pagamento aceites no POS conforme RF5.
/// </summary>
public enum MetodoPagamento : byte
{
    Numerario  = 1,
    Multibanco = 2,
    MBWay      = 3
}
