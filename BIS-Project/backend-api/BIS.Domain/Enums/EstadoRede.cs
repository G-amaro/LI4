namespace BIS.Domain.Enums;

/// <summary>
/// Estado de sincronização da loja com a Sede (RNF1 - Offline-First).
/// Atualizado pelo motor de sincronização a cada ciclo.
/// </summary>
public enum EstadoRede : byte
{
    Offline      = 1,
    Online       = 2,
    Sincronizada = 3
}
