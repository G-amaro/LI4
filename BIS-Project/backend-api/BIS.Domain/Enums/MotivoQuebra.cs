namespace BIS.Domain.Enums;

/// <summary>
/// Categorias de quebra de stock conforme RF15 e UC08.
/// Lista estrita para garantir dados tratáveis (não há "Outro" ou texto livre).
/// </summary>
public enum MotivoQuebra : byte
{
    ValidadeExpirada      = 1,
    DanoQuebraFisica      = 2,
    FurtoDesaparecimento  = 3
}
