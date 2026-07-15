namespace BIS.Api.DTOs;

/// <summary>
/// Representação de um Produto para envio ao cliente (POS ou Backoffice).
/// Inclui PrecoCusto apenas para perfis com permissão financeira
/// (o controller decide se inclui ou limpa este campo conforme o perfil do caller).
/// </summary>
public class ProdutoDto
{
    public int     Id         { get; set; }
    public string  EAN        { get; set; } = string.Empty;
    public string  Artigo     { get; set; } = string.Empty;
    public string  Categoria  { get; set; } = string.Empty;
    public decimal PrecoCusto { get; set; }
    public decimal PVP        { get; set; }
    public bool    Perecivel  { get; set; }
    public decimal TaxaIVA   { get; set; }
    public string? ImagemUrl { get; set; }
}
