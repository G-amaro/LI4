using System;
using System.ComponentModel.DataAnnotations;

namespace BIS.Api.DTOs;

/// <summary>
/// Resposta padrão de Fornecedor (lista, detalhe).
/// </summary>
public class FornecedorDto
{
    public int      Id           { get; set; }
    public string   Nome         { get; set; } = string.Empty;
    public string?  Nif          { get; set; }
    public string?  Telefone     { get; set; }
    public string?  Email        { get; set; }
    public string?  Morada       { get; set; }
    public string?  Observacoes  { get; set; }
    public bool     Ativo        { get; set; }
    public DateTime CriadoEm     { get; set; }
    public DateTime AtualizadoEm { get; set; }

    /// <summary>Número de receções já feitas com este fornecedor.</summary>
    public int      NumRececoes  { get; set; }

    /// <summary>Total gasto (€) ao longo de todas as receções.</summary>
    public decimal  TotalGasto   { get; set; }
}

/// <summary>
/// Input para criar fornecedor.
/// </summary>
public class CriarFornecedorDto
{
    [Required, MaxLength(150)]
    public string Nome { get; set; } = string.Empty;

    [MaxLength(20)]
    [RegularExpression(@"^\d{9}$", ErrorMessage = "NIF deve ter 9 dígitos.")]
    public string? Nif { get; set; }

    [MaxLength(20)]
    public string? Telefone { get; set; }

    [MaxLength(100), EmailAddress]
    public string? Email { get; set; }

    [MaxLength(255)]
    public string? Morada { get; set; }

    [MaxLength(500)]
    public string? Observacoes { get; set; }
}

/// <summary>
/// Input para actualizar fornecedor (mesmos campos + flag activo).
/// </summary>
public class AtualizarFornecedorDto : CriarFornecedorDto
{
    public bool Ativo { get; set; } = true;
}

/// <summary>
/// DTO simplificado para download/sync no POS.
/// Só os campos que o POS precisa para mostrar no selector.
/// </summary>
public class FornecedorSyncDto
{
    public int     Id       { get; set; }
    public string  Nome     { get; set; } = string.Empty;
    public string? Nif      { get; set; }
    public bool    Ativo    { get; set; }
}
