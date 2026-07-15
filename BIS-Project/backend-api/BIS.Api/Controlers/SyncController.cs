using Microsoft.EntityFrameworkCore;
using BIS.Api.DTOs;
using BIS.Domain.Entities;
using BIS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using BIS.Domain.Enums;

namespace BIS.Api.Controllers;

/// <summary>
/// Motor de Sincronização — recebe batches de transações acumuladas offline nos terminais POS.
///
/// Design de resiliência (RNF1):
///   1. Um Guid por Venda, gerado no POS.  Permite idempotência total.
///   2. Verificação de IDs existentes numa única query antes de inserir.
///   3. Toda a inserção do batch ocorre dentro de uma transaction de BD.
///      Se qualquer linha falhar, o batch inteiro faz rollback — evita dados parciais.
///   4. Vendas duplicadas (Guid já existe) são contadas e reportadas mas NÃO causam erro.
///   5. Vendas com dados inválidos (ProdutoId inexistente, LojaId inválida)
///      são reportadas individualmente em Erros[] e ignoradas sem bloquear o resto do batch.
/// </summary>
[ApiController]
[Route("api/sync")]
[Authorize]
public class SyncController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<SyncController> _logger;

    public SyncController(ApplicationDbContext db, ILogger<SyncController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // ─────────────────────────────────────────────────────────────────────
    /// <summary>
    /// Recebe um batch de vendas acumuladas offline de um Terminal POS.
    /// Idempotente: envios duplicados são ignorados sem retornar erro.
    /// </summary>
    [HttpPost("vendas")]
    public async Task<ActionResult<SyncVendasResponse>> SyncVendas([FromBody] SyncVendasRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var lojaIdClaim = User.FindFirstValue("loja_id");
        if (!int.TryParse(lojaIdClaim, out var lojaIdJwt))
            return Forbid();

        var isAdmin = User.IsInRole("Administrador") || User.IsInRole("GerenteSede");
        if (!isAdmin && lojaIdJwt != request.LojaId)
        {
            _logger.LogWarning("Sync bloqueado: JWT da loja {Jwt} tentou sincronizar loja {Payload}",
                lojaIdJwt, request.LojaId);
            return StatusCode(403, new { message = "Sem permissão para sincronizar dados desta loja." });
        }

        var lojaExiste = await _db.Lojas.AnyAsync(l => l.Id == request.LojaId && l.TemPOS);
        if (!lojaExiste)
            return BadRequest(new { message = $"Loja {request.LojaId} não encontrada." });

        var response = new SyncVendasResponse
        {
            ProcessadoEm = DateTime.UtcNow,
            TotalRecebidas = request.Vendas.Count
        };

        var idsNoPayload = request.Vendas.Select(v => v.Id).ToList();

        var idsJaExistentes = (await _db.Vendas
            .AsNoTracking()
            .Where(v => idsNoPayload.Contains(v.Id))
            .Select(v => v.Id)
            .ToListAsync())
            .ToHashSet();

        response.TotalDuplicadas = idsJaExistentes.Count;

        if (idsJaExistentes.Count > 0)
            _logger.LogInformation("Sync loja {Loja}: {N} venda(s) duplicada(s) ignoradas",
                request.LojaId, idsJaExistentes.Count);

        var vendasNovas = request.Vendas
            .Where(v => !idsJaExistentes.Contains(v.Id))
            .ToList();

        if (vendasNovas.Count == 0)
        {
            return Ok(response);
        }

        var produtoIdsNoBatch = vendasNovas
            .SelectMany(v => v.Linhas.Select(l => l.ProdutoId))
            .Distinct()
            .ToList();

        var produtoIdsValidos = (await _db.Produtos
            .AsNoTracking()
            .Where(p => produtoIdsNoBatch.Contains(p.Id))
            .Select(p => p.Id)
            .ToListAsync())
            .ToHashSet();

        var operadorIdsNoBatch = vendasNovas
            .Select(v => v.OperadorId)
            .Distinct()
            .ToList();

        var operadorIdsValidos = (await _db.Utilizadores
            .AsNoTracking()
            .Where(u => operadorIdsNoBatch.Contains(u.Id))
            .Select(u => u.Id)
            .ToListAsync())
            .ToHashSet();

        var vendasParaInserir = new List<Venda>();

        foreach (var dto in vendasNovas)
        {
            if (!operadorIdsValidos.Contains(dto.OperadorId))
            {
                response.Erros.Add(new SyncItemErro
                {
                    VendaId = dto.Id,
                    Motivo = $"OperadorId {dto.OperadorId} não existe na base de dados."
                });
                continue;
            }

            var produtoInvalido = dto.Linhas.FirstOrDefault(l => !produtoIdsValidos.Contains(l.ProdutoId));
            if (produtoInvalido is not null)
            {
                response.Erros.Add(new SyncItemErro
                {
                    VendaId = dto.Id,
                    Motivo = $"ProdutoId {produtoInvalido.ProdutoId} não encontrado no catálogo."
                });
                continue;
            }

            var venda = new Venda
            {
                Id = dto.Id,
                LojaId = request.LojaId,
                OperadorId = dto.OperadorId,
                DataTransacao = DateTime.SpecifyKind(dto.DataTransacao, DateTimeKind.Utc),
                ValorTotal = dto.ValorTotal,
                MetodoPagamento = dto.MetodoPagamento,
                NifCliente = dto.NifCliente,
                DataSincronizacao = response.ProcessadoEm,
                Linhas = dto.Linhas.Select(l => new LinhaVenda
                {
                    ProdutoId = l.ProdutoId,
                    Quantidade = l.Quantidade,
                    PrecoUnitario = l.PrecoUnitario,
                    Subtotal = l.Subtotal
                }).ToList()
            };

            vendasParaInserir.Add(venda);
        }

        if (vendasParaInserir.Count > 0)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                _db.Vendas.AddRange(vendasParaInserir);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                response.TotalInseridas = vendasParaInserir.Count;

                _logger.LogInformation(
                    "Sync loja {Loja}: {Inseridas} inseridas, {Dup} duplicadas, {Err} erros",
                    request.LojaId,
                    response.TotalInseridas,
                    response.TotalDuplicadas,
                    response.Erros.Count);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Erro ao inserir batch de sync da loja {Loja}", request.LojaId);
                return StatusCode(500, new { message = "Erro interno ao processar sincronização. Tenta de novo." });
            }
        }

        try
        {
            var loja = await _db.Lojas.FindAsync(request.LojaId);
            if (loja is not null)
            {
                loja.UltimaSincronizacao = response.ProcessadoEm;
                loja.EstadoRede = Domain.Enums.EstadoRede.Sincronizada;
                await _db.SaveChangesAsync();
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Não foi possível actualizar timestamp da loja {Loja}", request.LojaId);
        }

        return Ok(response);
    }

    // ─── POST /api/sync/quebras ──────────────────────────────────────

    [HttpPost("quebras")]
    public async Task<ActionResult<SyncQuebrasResponse>> SyncQuebras(
        [FromBody] SyncQuebrasRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var lojaIdClaim = User.FindFirstValue("loja_id");
        if (!int.TryParse(lojaIdClaim, out var lojaIdJwt))
            return Forbid();

        var isAdmin = User.IsInRole("Administrador") || User.IsInRole("GerenteSede");
        if (!isAdmin && lojaIdJwt != request.LojaId)
        {
            _logger.LogWarning("SyncQuebras bloqueado: JWT loja {Jwt} vs payload {Payload}",
                lojaIdJwt, request.LojaId);
            return StatusCode(403, new { message = "Sem permissão para sincronizar dados desta loja." });
        }

        var lojaExiste = await _db.Lojas.AnyAsync(l => l.Id == request.LojaId && l.TemPOS);
        if (!lojaExiste)
            return BadRequest(new { message = $"Loja {request.LojaId} não encontrada." });

        var response = new SyncQuebrasResponse
        {
            ProcessadoEm = DateTime.UtcNow,
            TotalRecebidas = request.Quebras.Count
        };

        var idsPayload = request.Quebras.Select(q => q.Id).ToList();
        var idsExistentes = await _db.Quebras
            .AsNoTracking()
            .Where(q => idsPayload.Contains(q.Id))
            .Select(q => q.Id)
            .ToListAsync();

        response.TotalDuplicadas = idsExistentes.Count;

        var quebrasNovas = request.Quebras
            .Where(q => !idsExistentes.Contains(q.Id))
            .ToList();

        if (quebrasNovas.Count == 0)
            return Ok(response);

        var produtoIds = quebrasNovas.Select(q => q.ProdutoId).Distinct().ToList();
        var operadorIds = quebrasNovas.Select(q => q.OperadorId).Distinct().ToList();

        var produtosValidos = await _db.Produtos.AsNoTracking()
            .Where(p => produtoIds.Contains(p.Id)).Select(p => p.Id).ToListAsync();
        var operadoresValidos = await _db.Utilizadores.AsNoTracking()
            .Where(u => operadorIds.Contains(u.Id)).Select(u => u.Id).ToListAsync();

        var quebrasParaInserir = new List<Domain.Entities.Quebra>();

        foreach (var dto in quebrasNovas)
        {
            if (!operadoresValidos.Contains(dto.OperadorId))
            {
                response.Erros.Add(new SyncItemErro
                {
                    VendaId = dto.Id,
                    Motivo = $"OperadorId {dto.OperadorId} não existe."
                });
                continue;
            }
            if (!produtosValidos.Contains(dto.ProdutoId))
            {
                response.Erros.Add(new SyncItemErro
                {
                    VendaId = dto.Id,
                    Motivo = $"ProdutoId {dto.ProdutoId} não encontrado."
                });
                continue;
            }

            quebrasParaInserir.Add(new Domain.Entities.Quebra
            {
                Id = dto.Id,
                LojaId = request.LojaId,
                OperadorId = dto.OperadorId,
                ProdutoId = dto.ProdutoId,
                Quantidade = dto.Quantidade,
                ValorPerdido = dto.ValorPerdido,
                Motivo = dto.Motivo,
                DataRegisto = DateTime.SpecifyKind(dto.DataRegisto, DateTimeKind.Utc),
                DataSincronizacao = response.ProcessadoEm
            });
        }

        if (quebrasParaInserir.Count > 0)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                _db.Quebras.AddRange(quebrasParaInserir);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                response.TotalInseridas = quebrasParaInserir.Count;
                _logger.LogInformation("SyncQuebras loja {Loja}: {N} inseridas", request.LojaId, response.TotalInseridas);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Erro ao inserir quebras da loja {Loja}", request.LojaId);
                return StatusCode(500, new { message = "Erro interno ao processar quebras." });
            }
        }

        return Ok(response);
    }

    // ─── POST /api/sync/fechos ───────────────────────────────────────

    [HttpPost("fechos")]
    public async Task<ActionResult<SyncFechosResponse>> SyncFechos(
        [FromBody] SyncFechosRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var lojaIdClaim = User.FindFirstValue("loja_id");
        if (!int.TryParse(lojaIdClaim, out var lojaIdJwt))
            return Forbid();

        var isAdmin = User.IsInRole("Administrador") || User.IsInRole("GerenteSede");
        if (!isAdmin && lojaIdJwt != request.LojaId)
            return StatusCode(403, new { message = "Sem permissão para sincronizar fechos desta loja." });

        var lojaExiste = await _db.Lojas.AnyAsync(l => l.Id == request.LojaId && l.TemPOS);
        if (!lojaExiste)
            return BadRequest(new { message = $"Loja {request.LojaId} não encontrada." });

        var response = new SyncFechosResponse
        {
            ProcessadoEm = DateTime.UtcNow,
            TotalRecebidas = request.Fechos.Count
        };

        var idsPayload = request.Fechos.Select(f => f.Id).ToList();
        var idsExistentes = await _db.FechosCaixa
            .AsNoTracking()
            .Where(f => idsPayload.Contains(f.Id))
            .Select(f => f.Id)
            .ToListAsync();

        response.TotalDuplicadas = idsExistentes.Count;

        var fechosNovos = request.Fechos
            .Where(f => !idsExistentes.Contains(f.Id))
            .ToList();

        if (fechosNovos.Count == 0)
            return Ok(response);

        var operadorIds = fechosNovos.Select(f => f.OperadorId).Distinct().ToList();
        var operadoresValidos = await _db.Utilizadores
            .AsNoTracking()
            .Where(u => operadorIds.Contains(u.Id))
            .Select(u => u.Id)
            .ToListAsync();

        var entidades = new List<Domain.Entities.FechoCaixa>();

        foreach (var dto in fechosNovos)
        {
            if (!operadoresValidos.Contains(dto.OperadorId))
            {
                response.Erros.Add(new SyncItemErro
                {
                    VendaId = dto.Id,
                    Motivo = $"OperadorId {dto.OperadorId} não existe."
                });
                continue;
            }

            entidades.Add(new Domain.Entities.FechoCaixa
            {
                Id = dto.Id,
                LojaId = request.LojaId,
                OperadorId = dto.OperadorId,
                DataFecho = DateTime.SpecifyKind(dto.DataFecho, DateTimeKind.Utc),
                TeoricoNumerario = dto.TeoricoNumerario,
                TeoricoMultibanco = dto.TeoricoMultibanco,
                TeoricoMbway = dto.TeoricoMbway,
                TeoricoTotal = dto.TeoricoTotal,
                ContadoNumerario = dto.ContadoNumerario,
                ContadoMultibanco = dto.ContadoMultibanco,
                ContadoMbway = dto.ContadoMbway,
                ContadoTotal = dto.ContadoTotal,
                Discrepancia = dto.Discrepancia,
                TemDiscrepancia = dto.TemDiscrepancia,
                Justificacao = dto.Justificacao,
                DataSincronizacao = response.ProcessadoEm
            });
        }

        if (entidades.Count > 0)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                _db.FechosCaixa.AddRange(entidades);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                response.TotalInseridas = entidades.Count;
                _logger.LogInformation(
                    "SyncFechos loja {Loja}: {N} fecho(s) inseridos",
                    request.LojaId, response.TotalInseridas);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Erro ao inserir fechos da loja {Loja}", request.LojaId);
                return StatusCode(500, new { message = "Erro interno ao processar fechos." });
            }
        }

        return Ok(response);
    }

    // ─── POST /api/sync/transferencias ─────────────────────────────────

    [HttpPost("transferencias")]
    public async Task<ActionResult<SyncTransferenciasResponse>> SyncTransferencias(
        [FromBody] SyncTransferenciasRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var lojaIdClaim = User.FindFirstValue("loja_id");
        if (!int.TryParse(lojaIdClaim, out var lojaIdJwt))
            return Forbid();

        var isAdmin = User.IsInRole("Administrador") || User.IsInRole("GerenteSede");
        if (!isAdmin && lojaIdJwt != request.LojaId)
        {
            _logger.LogWarning("SyncTransferencias bloqueado: JWT {Jwt} vs payload {Payload}",
                lojaIdJwt, request.LojaId);
            return StatusCode(403, new { message = "Sem permissão para sincronizar transferências desta loja." });
        }

        var lojaExiste = await _db.Lojas.AnyAsync(l => l.Id == request.LojaId && l.TemPOS);
        if (!lojaExiste)
            return BadRequest(new { message = $"Loja {request.LojaId} não encontrada." });

        var response = new SyncTransferenciasResponse
        {
            ProcessadoEm = DateTime.UtcNow,
            TotalRecebidas = request.Transferencias.Count
        };

        var idsPayload = request.Transferencias.Select(t => t.Id).ToList();
        var idsExistentes = await _db.Transferencias
            .AsNoTracking()
            .Where(t => idsPayload.Contains(t.Id))
            .Select(t => t.Id)
            .ToListAsync();

        response.TotalDuplicadas = idsExistentes.Count;

        var novas = request.Transferencias
            .Where(t => !idsExistentes.Contains(t.Id))
            .ToList();

        if (novas.Count == 0)
            return Ok(response);

        var operadorIds = novas.Select(t => t.OperadorId).Distinct().ToList();
        var produtoIds = novas.SelectMany(t => t.Linhas).Select(l => l.ProdutoId).Distinct().ToList();
        var envioIds = novas
            .Where(t => t.TipoMovimento == TipoMovimentoTransferencia.Rececao
                     && t.TransferenciaEnvioId.HasValue)
            .Select(t => t.TransferenciaEnvioId!.Value)
            .Distinct()
            .ToList();

        var operadoresValidos = await _db.Utilizadores.AsNoTracking()
            .Where(u => operadorIds.Contains(u.Id))
            .Select(u => u.Id)
            .ToListAsync();

        var produtosValidos = await _db.Produtos.AsNoTracking()
            .Where(p => produtoIds.Contains(p.Id))
            .Select(p => p.Id)
            .ToListAsync();

        var enviosExistentes = await _db.Transferencias.AsNoTracking()
            .Where(t => envioIds.Contains(t.Id)
                     && t.TipoMovimento == TipoMovimentoTransferencia.Envio)
            .Select(t => t.Id)
            .ToListAsync();

        var entidades = new List<Domain.Entities.Transferencia>();

        foreach (var dto in novas)
        {
            if (!operadoresValidos.Contains(dto.OperadorId))
            {
                response.Erros.Add(new SyncItemErro
                {
                    VendaId = dto.Id,
                    Motivo = $"OperadorId {dto.OperadorId} não existe."
                });
                continue;
            }

            var produtoInvalido = dto.Linhas.FirstOrDefault(l => !produtosValidos.Contains(l.ProdutoId));
            if (produtoInvalido != null)
            {
                response.Erros.Add(new SyncItemErro
                {
                    VendaId = dto.Id,
                    Motivo = $"ProdutoId {produtoInvalido.ProdutoId} não existe."
                });
                continue;
            }

            if (dto.TipoMovimento == TipoMovimentoTransferencia.Rececao)
            {
                if (!dto.TransferenciaEnvioId.HasValue)
                {
                    response.Erros.Add(new SyncItemErro
                    {
                        VendaId = dto.Id,
                        Motivo = "RECECAO sem TransferenciaEnvioId."
                    });
                    continue;
                }
                if (!enviosExistentes.Contains(dto.TransferenciaEnvioId.Value))
                {
                    response.Erros.Add(new SyncItemErro
                    {
                        VendaId = dto.Id,
                        Motivo = $"Envio original {dto.TransferenciaEnvioId.Value} não encontrado na Sede."
                    });
                    continue;
                }
            }

            entidades.Add(new Domain.Entities.Transferencia
            {
                Id = dto.Id,
                TipoMovimento = dto.TipoMovimento,
                LojaOrigemId = dto.LojaOrigemId,
                LojaDestinoId = dto.LojaDestinoId,
                OperadorId = dto.OperadorId,
                DataMovimento = DateTime.SpecifyKind(dto.DataMovimento, DateTimeKind.Utc),
                TransferenciaEnvioId = dto.TransferenciaEnvioId,
                DocumentoReferencia = dto.DocumentoReferencia,
                Observacoes = dto.Observacoes,
                NumeroLinhas = dto.Linhas.Count,
                TotalUnidades = dto.Linhas.Sum(l => l.Quantidade),
                DataSincronizacao = response.ProcessadoEm,
                Linhas = dto.Linhas.Select(l => new Domain.Entities.LinhaTransferencia
                {
                    ProdutoId = l.ProdutoId,
                    Quantidade = l.Quantidade
                }).ToList()
            });
        }

        if (entidades.Count > 0)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                _db.Transferencias.AddRange(entidades);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                response.TotalInseridas = entidades.Count;
                _logger.LogInformation(
                    "SyncTransferencias loja {Loja}: {N} movimento(s) inseridos",
                    request.LojaId, response.TotalInseridas);
            }
            catch (DbUpdateException ex) when (
                ex.InnerException?.Message.Contains("Duplicate") == true ||
                ex.InnerException?.Message.Contains("UNIQUE") == true)
            {
                await transaction.RollbackAsync();
                return Conflict(new { message = "Uma das recepções já existe na Sede (duplicação)." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Erro ao inserir transferências da loja {Loja}", request.LojaId);
                return StatusCode(500, new { message = "Erro interno ao processar transferências." });
            }
        }

        return Ok(response);
    }

    // ─── GET /api/sync/transferencias/pendentes ─────────────────────────

    [HttpGet("transferencias/pendentes")]
    public async Task<ActionResult<IEnumerable<GuiaTransferenciaPendenteDto>>> GetTransferenciasPendentes(
        [FromQuery] int lojaDestinoId)
    {
        if (lojaDestinoId < 1)
            return BadRequest(new { message = "lojaDestinoId inválido." });

        var lojaIdClaim = User.FindFirstValue("loja_id");
        if (!int.TryParse(lojaIdClaim, out var lojaIdJwt))
            return Forbid();

        var isAdmin = User.IsInRole("Administrador") || User.IsInRole("GerenteSede");
        if (!isAdmin && lojaIdJwt != lojaDestinoId)
            return StatusCode(403, new { message = "Só podes consultar transferências destinadas à tua loja." });

        var envioIdsJaRecebidos = _db.Transferencias
            .Where(t => t.TipoMovimento == TipoMovimentoTransferencia.Rececao
                     && t.TransferenciaEnvioId.HasValue)
            .Select(t => t.TransferenciaEnvioId!.Value);

        var pendentes = await _db.Transferencias
            .AsNoTracking()
            .Where(t => t.TipoMovimento == TipoMovimentoTransferencia.Envio
                     && t.LojaDestinoId == lojaDestinoId
                     && !envioIdsJaRecebidos.Contains(t.Id))
            .Include(t => t.LojaOrigem)
            .Include(t => t.Linhas).ThenInclude(l => l.Produto)
            .OrderBy(t => t.DataMovimento)
            .ToListAsync();

        var resultado = pendentes.Select(t => new GuiaTransferenciaPendenteDto
        {
            Id = t.Id,
            LojaOrigemId = t.LojaOrigemId,
            LojaOrigemNome = t.LojaOrigem?.Nome ?? $"Loja #{t.LojaOrigemId}",
            LojaDestinoId = t.LojaDestinoId,
            DataMovimento = t.DataMovimento,
            DocumentoReferencia = t.DocumentoReferencia,
            Observacoes = t.Observacoes,
            Linhas = t.Linhas.Select(l => new GuiaLinhaDto
            {
                ProdutoId = l.ProdutoId,
                EAN = l.Produto?.EAN ?? string.Empty,
                Artigo = l.Produto?.Artigo ?? "—",
                Categoria = l.Produto?.Categoria ?? "—",
                Quantidade = l.Quantidade
            }).ToList()
        }).ToList();

        _logger.LogInformation(
            "GetTransferenciasPendentes loja {Loja}: {N} guia(s) em trânsito",
            lojaDestinoId, resultado.Count);

        return Ok(resultado);
    }

    // ─── POST /api/sync/devolucoes ──────────────────────────────────

    [HttpPost("devolucoes")]
    public async Task<ActionResult<SyncDevolucoesResponse>> SyncDevolucoes(
        [FromBody] SyncDevolucoesRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var lojaIdClaim = User.FindFirstValue("loja_id");
        if (!int.TryParse(lojaIdClaim, out var lojaIdJwt))
            return Forbid();

        var isAdmin = User.IsInRole("Administrador") || User.IsInRole("GerenteSede");
        if (!isAdmin && lojaIdJwt != request.LojaId)
        {
            _logger.LogWarning("SyncDevolucoes bloqueado: JWT {Jwt} vs payload {Payload}",
                lojaIdJwt, request.LojaId);
            return StatusCode(403, new { message = "Sem permissão para sincronizar devoluções desta loja." });
        }

        var lojaExiste = await _db.Lojas.AnyAsync(l => l.Id == request.LojaId && l.TemPOS);
        if (!lojaExiste)
            return BadRequest(new { message = $"Loja {request.LojaId} não encontrada." });

        var response = new SyncDevolucoesResponse
        {
            ProcessadoEm = DateTime.UtcNow,
            TotalRecebidas = request.Devolucoes.Count
        };

        var idsPayload = request.Devolucoes.Select(d => d.Id).ToList();
        var idsExistentes = await _db.Devolucoes
            .AsNoTracking()
            .Where(d => idsPayload.Contains(d.Id))
            .Select(d => d.Id)
            .ToListAsync();

        response.TotalDuplicadas = idsExistentes.Count;

        var novas = request.Devolucoes
            .Where(d => !idsExistentes.Contains(d.Id))
            .ToList();

        if (novas.Count == 0)
            return Ok(response);

        var vendaIds = novas.Select(d => d.VendaOriginalId).Distinct().ToList();
        var operadorIds = novas.Select(d => d.OperadorId).Distinct().ToList();
        var produtoIds = novas.SelectMany(d => d.Linhas).Select(l => l.ProdutoId).Distinct().ToList();

        var vendasValidas = await _db.Vendas.AsNoTracking()
            .Where(v => vendaIds.Contains(v.Id)).Select(v => v.Id).ToListAsync();
        var operadoresValidos = await _db.Utilizadores.AsNoTracking()
            .Where(u => operadorIds.Contains(u.Id)).Select(u => u.Id).ToListAsync();
        var produtosValidos = await _db.Produtos.AsNoTracking()
            .Where(p => produtoIds.Contains(p.Id)).Select(p => p.Id).ToListAsync();

        var entidades = new List<Domain.Entities.Devolucao>();

        foreach (var dto in novas)
        {
            if (!vendasValidas.Contains(dto.VendaOriginalId))
            {
                response.Erros.Add(new SyncItemErro
                {
                    VendaId = dto.Id,
                    Motivo = $"Venda original {dto.VendaOriginalId} não encontrada na Sede."
                });
                continue;
            }

            if (!operadoresValidos.Contains(dto.OperadorId))
            {
                response.Erros.Add(new SyncItemErro
                {
                    VendaId = dto.Id,
                    Motivo = $"OperadorId {dto.OperadorId} não existe."
                });
                continue;
            }

            var produtoInvalido = dto.Linhas.FirstOrDefault(l => !produtosValidos.Contains(l.ProdutoId));
            if (produtoInvalido != null)
            {
                response.Erros.Add(new SyncItemErro
                {
                    VendaId = dto.Id,
                    Motivo = $"ProdutoId {produtoInvalido.ProdutoId} não existe."
                });
                continue;
            }

            entidades.Add(new Domain.Entities.Devolucao
            {
                Id = dto.Id,
                VendaOriginalId = dto.VendaOriginalId,
                LojaId = request.LojaId,
                OperadorId = dto.OperadorId,
                DataDevolucao = DateTime.SpecifyKind(dto.DataDevolucao, DateTimeKind.Utc),
                ValorReembolsado = dto.ValorReembolsado,
                Motivo = dto.Motivo,
                DataSincronizacao = response.ProcessadoEm,
                Linhas = dto.Linhas.Select(l => new Domain.Entities.LinhaDevolucao
                {
                    ProdutoId = l.ProdutoId,
                    Quantidade = l.Quantidade,
                    PrecoUnitario = l.PrecoUnitario,
                    Subtotal = l.Subtotal
                }).ToList()
            });
        }

        if (entidades.Count > 0)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                _db.Devolucoes.AddRange(entidades);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                response.TotalInseridas = entidades.Count;
                _logger.LogInformation(
                    "SyncDevolucoes loja {Loja}: {N} devolução(ões) inseridas",
                    request.LojaId, response.TotalInseridas);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Erro ao inserir devoluções da loja {Loja}", request.LojaId);
                return StatusCode(500, new { message = "Erro interno ao processar devoluções." });
            }
        }

        return Ok(response);
    }

    // ─── POST /api/sync/rececoes ────────────────────────────────────
    // Fase 4: aceita FornecedorId e PrecoCusto por linha.

    [HttpPost("rececoes")]
    public async Task<ActionResult<SyncRececoesResponse>> SyncRececoes(
    [FromBody] SyncRececoesRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var lojaIdClaim = User.FindFirstValue("loja_id");
        if (!int.TryParse(lojaIdClaim, out var lojaIdJwt))
            return Forbid();

        var isAdmin = User.IsInRole("Administrador") || User.IsInRole("GerenteSede");
        if (!isAdmin && lojaIdJwt != request.LojaId)
        {
            _logger.LogWarning("SyncRececoes bloqueado: JWT {Jwt} vs payload {Payload}",
                lojaIdJwt, request.LojaId);
            return StatusCode(403, new { message = "Sem permissão para sincronizar receções desta loja." });
        }

        var lojaExiste = await _db.Lojas.AnyAsync(l => l.Id == request.LojaId && l.TemPOS);
        if (!lojaExiste)
            return BadRequest(new { message = $"Loja {request.LojaId} não encontrada." });

        var response = new SyncRececoesResponse
        {
            ProcessadoEm = DateTime.UtcNow,
            TotalRecebidas = request.Rececoes.Count
        };

        // Idempotência por Guid
        var idsPayload = request.Rececoes.Select(r => r.Id).ToList();
        var idsExistentes = await _db.Rececoes
            .AsNoTracking()
            .Where(r => idsPayload.Contains(r.Id))
            .Select(r => r.Id)
            .ToListAsync();

        response.TotalDuplicadas = idsExistentes.Count;

        var novas = request.Rececoes
            .Where(r => !idsExistentes.Contains(r.Id))
            .ToList();

        if (novas.Count == 0)
            return Ok(response);

        // Pré-validar FK
        var operadorIds = novas.Select(r => r.OperadorId).Distinct().ToList();
        var produtoIds = novas.SelectMany(r => r.Linhas).Select(l => l.ProdutoId).Distinct().ToList();

        // [+ Fase 4] Pré-validar fornecedores que apareçam no batch
        var fornecedorIds = novas
            .Where(r => r.FornecedorId.HasValue)
            .Select(r => r.FornecedorId!.Value)
            .Distinct()
            .ToList();

        var operadoresValidos = await _db.Utilizadores.AsNoTracking()
            .Where(u => operadorIds.Contains(u.Id)).Select(u => u.Id).ToListAsync();
        var produtosValidos = await _db.Produtos.AsNoTracking()
            .Where(p => produtoIds.Contains(p.Id)).Select(p => p.Id).ToListAsync();

        var fornecedoresValidos = fornecedorIds.Count == 0
            ? new List<int>()
            : await _db.Fornecedores.AsNoTracking()
                .Where(f => fornecedorIds.Contains(f.Id))
                .Select(f => f.Id)
                .ToListAsync();

        // Produtos perecíveis (validação Fase 2 — Lote/Validade)
        var produtosPereciveis = await _db.Produtos
            .AsNoTracking()
            .Where(p => produtoIds.Contains(p.Id) && p.Perecivel)
            .Select(p => p.Id)
            .ToListAsync();

        var entidades = new List<Domain.Entities.Rececao>();

        foreach (var dto in novas)
        {
            if (!operadoresValidos.Contains(dto.OperadorId))
            {
                response.Erros.Add(new SyncItemErro
                {
                    VendaId = dto.Id,
                    Motivo = $"OperadorId {dto.OperadorId} não existe."
                });
                continue;
            }

            // [+ Fase 4] Validação de fornecedor (se preenchido)
            if (dto.FornecedorId.HasValue && !fornecedoresValidos.Contains(dto.FornecedorId.Value))
            {
                response.Erros.Add(new SyncItemErro
                {
                    VendaId = dto.Id,
                    Motivo = $"FornecedorId {dto.FornecedorId.Value} não existe ou está inactivo."
                });
                continue;
            }

            var produtoInvalido = dto.Linhas.FirstOrDefault(l => !produtosValidos.Contains(l.ProdutoId));
            if (produtoInvalido != null)
            {
                response.Erros.Add(new SyncItemErro
                {
                    VendaId = dto.Id,
                    Motivo = $"ProdutoId {produtoInvalido.ProdutoId} não existe."
                });
                continue;
            }

            // Fase 2: perecíveis exigem lote + validade
            var linhaPerecivelInvalida = dto.Linhas.FirstOrDefault(l =>
                produtosPereciveis.Contains(l.ProdutoId)
                && (string.IsNullOrWhiteSpace(l.Lote) || !l.DataValidade.HasValue));

            if (linhaPerecivelInvalida != null)
            {
                response.Erros.Add(new SyncItemErro
                {
                    VendaId = dto.Id,
                    Motivo = $"Produto {linhaPerecivelInvalida.ProdutoId} é perecível — Lote e DataValidade são obrigatórios."
                });
                continue;
            }

            if (dto.FornecedorId.HasValue)
            {
                var fornecedorExiste = await _db.Fornecedores
                    .AnyAsync(f => f.Id == dto.FornecedorId.Value);
                if (!fornecedorExiste)
                {
                    response.Erros.Add(new SyncItemErro
                    {
                        VendaId = dto.Id,
                        Motivo = $"FornecedorId {dto.FornecedorId.Value} não existe."
                    });
                    continue;
                }
            }


            entidades.Add(new Domain.Entities.Rececao
            {
                Id = dto.Id,
                LojaId = request.LojaId,
                OperadorId = dto.OperadorId,
                DataRececao = DateTime.SpecifyKind(dto.DataRececao, DateTimeKind.Utc),
                DocumentoReferencia = dto.DocumentoReferencia,
                FornecedorId = dto.FornecedorId,                          // [+ Fase 4]
                NumeroLinhas = dto.Linhas.Count,
                TotalUnidades = dto.Linhas.Sum(l => l.Quantidade),
                DataSincronizacao = response.ProcessadoEm,
                Linhas = dto.Linhas.Select(l => new Domain.Entities.LinhaRececao
                {
                    ProdutoId = l.ProdutoId,
                    Quantidade = l.Quantidade,
                    Lote = l.Lote,
                    DataValidade = l.DataValidade.HasValue
                        ? DateTime.SpecifyKind(l.DataValidade.Value, DateTimeKind.Utc)
                        : null,
                    PrecoCusto = l.PrecoCusto                              // [+ Fase 4]
                }).ToList()
            });
        }

        if (entidades.Count > 0)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                _db.Rececoes.AddRange(entidades);
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                response.TotalInseridas = entidades.Count;
                _logger.LogInformation(
                    "SyncRececoes loja {Loja}: {N} receção(ões) inseridas",
                    request.LojaId, response.TotalInseridas);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Erro ao inserir receções da loja {Loja}", request.LojaId);
                return StatusCode(500, new { message = "Erro interno ao processar receções." });
            }
        }

        return Ok(response);
    }

    // ─── GET /api/sync/fornecedores ────────────────────────────────
    // Catálogo simplificado de fornecedores activos para download no POS.

    [HttpGet("fornecedores")]
    public async Task<ActionResult<List<FornecedorSyncDto>>> SyncFornecedores()
    {
        var fornecedores = await _db.Fornecedores
            .AsNoTracking()
            .Where(f => f.Ativo)
            .OrderBy(f => f.Nome)
            .Select(f => new FornecedorSyncDto
            {
                Id = f.Id,
                Nome = f.Nome,
                Nif = f.Nif,
                Ativo = f.Ativo
            })
            .ToListAsync();

        _logger.LogInformation(
            "[Sync/Fornecedores] {Count} fornecedor(es) enviado(s)",
            fornecedores.Count);

        return Ok(fornecedores);
    }
    

    [HttpGet("stock")]
public async Task<IActionResult> SyncStock([FromQuery] int lojaId)
{
    var lojaValida = await _db.Lojas.AnyAsync(l => l.Id == lojaId && l.TemPOS);
    if (!lojaValida)
        return BadRequest(new { message = "Loja inválida ou sem POS." });

    // Receções
    var rec = await _db.LinhasRececao.Include(l => l.Rececao)
        .Where(l => l.Rececao!.LojaId == lojaId)
        .GroupBy(l => l.ProdutoId)
        .Select(g => new { g.Key, Total = g.Sum(x => x.Quantidade) })
        .ToDictionaryAsync(x => x.Key, x => (int)x.Total);

    // Vendas
    var ven = await _db.LinhasVenda.Include(l => l.Venda)
        .Where(l => l.Venda!.LojaId == lojaId)
        .GroupBy(l => l.ProdutoId)
        .Select(g => new { g.Key, Total = g.Sum(x => (int)x.Quantidade) })
        .ToDictionaryAsync(x => x.Key, x => x.Total);

    // Quebras
    var que = await _db.Quebras.Where(q => q.LojaId == lojaId)
        .GroupBy(q => q.ProdutoId)
        .Select(g => new { g.Key, Total = g.Sum(x => x.Quantidade) })
        .ToDictionaryAsync(x => x.Key, x => (int)x.Total);

    // Devoluções
    var dev = await _db.LinhasDevolucao.Include(l => l.Devolucao)
        .Where(l => l.Devolucao!.LojaId == lojaId)
        .GroupBy(l => l.ProdutoId)
        .Select(g => new { g.Key, Total = g.Sum(x => x.Quantidade) })
        .ToDictionaryAsync(x => x.Key, x => x.Total);

    // Transferências
    var transf = await _db.LinhasTransferencia.Include(l => l.Transferencia)
        .Where(l => l.Transferencia!.LojaOrigemId == lojaId
                 || l.Transferencia!.LojaDestinoId == lojaId)
        .Select(l => new {
            l.Transferencia!.TipoMovimento,
            l.Transferencia!.LojaOrigemId,
            l.Transferencia!.LojaDestinoId,
            l.ProdutoId, l.Quantidade
        })
        .ToListAsync();

    // Calcular
    var stock = new Dictionary<int, int>();
    void Add(int pid, int qtd) => stock[pid] = stock.GetValueOrDefault(pid) + qtd;

    foreach (var x in rec) Add(x.Key, +x.Value);
    foreach (var x in dev) Add(x.Key, +x.Value);
    foreach (var x in ven) Add(x.Key, -x.Value);
    foreach (var x in que) Add(x.Key, -x.Value);
    foreach (var t in transf)
    {
        if (t.TipoMovimento == TipoMovimentoTransferencia.Envio && t.LojaOrigemId == lojaId)
            Add(t.ProdutoId, -t.Quantidade);
        else if (t.TipoMovimento == TipoMovimentoTransferencia.Rececao && t.LojaDestinoId == lojaId)
            Add(t.ProdutoId, +t.Quantidade);
    }

    return Ok(stock
        .Where(kv => kv.Value > 0)
        .Select(kv => new { produtoId = kv.Key, quantidade = kv.Value }));
}
}
