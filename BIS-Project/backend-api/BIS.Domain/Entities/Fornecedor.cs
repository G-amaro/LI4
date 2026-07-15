using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace BIS.Domain.Entities;

/// <summary>
/// Fornecedor — entidade gerida exclusivamente na Sede e replicada para
/// os terminais POS via sync (somente leitura no POS).
///
/// Cada Receção fica associada a 1 Fornecedor. Permite:
///   - Saber quem fornece o quê
///   - Calcular custos reais por receção
///   - Relatórios de compras por fornecedor
/// </summary>
public class Fornecedor
{
    public int Id { get; set; }

    [Required]
    [MaxLength(150)]
    public string Nome { get; set; } = string.Empty;

    /// <summary>NIF de empresa (9 dígitos), opcional para casos informais.</summary>
    [MaxLength(20)]
    public string? Nif { get; set; }

    [MaxLength(20)]
    public string? Telefone { get; set; }

    [MaxLength(100)]
    public string? Email { get; set; }

    [MaxLength(255)]
    public string? Morada { get; set; }

    [MaxLength(500)]
    public string? Observacoes { get; set; }

    /// <summary>Marcar como inactivo em vez de eliminar (preserva histórico).</summary>
    public bool Ativo { get; set; } = true;

    public DateTime CriadoEm     { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;

    // ─── Navigation ─────────────────────────────────────────
    public ICollection<Rececao>? Rececoes { get; set; }
}
