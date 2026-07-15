namespace BIS.Domain.Enums;

/// <summary>
/// Perfis RBAC do sistema BIS conforme RF2 e UC11.
/// Hierarquia: Funcionario &lt; GerenteLoja &lt; GerenteSede &lt; Administrador.
/// </summary>
public enum PerfilUtilizador : byte
{
    Funcionario   = 1,
    GerenteLoja   = 2,
    GerenteSede   = 3,
    Administrador = 4
}
