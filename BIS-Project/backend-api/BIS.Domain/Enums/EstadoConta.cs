namespace BIS.Domain.Enums;

/// <summary>
/// Estado de uma conta de utilizador.
/// Usado pelo Kill Switch (UC11/FA1) para revogar acesso instantaneamente.
/// </summary>
public enum EstadoConta : byte
{
    Ativo     = 1,
    Bloqueado = 2,
    Inativo   = 3
}
