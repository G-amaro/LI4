/**
 * seed-pos.js — Seed automático via API REST
 * Popula as 3 lojas POS com dados realistas e consistentes.
 *
 * Uso:
 *   node seed-pos.js
 *
 * Pré-requisitos:
 *   - Backend a correr em http://localhost:5254
 *   - BD MySQL limpa (dados transacionais apagados)
 */

const BASE = 'http://localhost:5254'

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function diasAtras(n, horasExtra = 0) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(d.getHours() - horasExtra)
  return d.toISOString()
}

function dataFutura(dias) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST', headers, body: JSON.stringify(body)
  })
  if (!r.ok) {
    const txt = await r.text()
    throw new Error(`POST ${path} → ${r.status}: ${txt.slice(0, 300)}`)
  }
  return r.json()
}

async function get(path, token) {
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {}
  const r = await fetch(`${BASE}${path}`, { headers })
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`)
  return r.json()
}

async function login() {
  const r = await post('/api/auth/login', {
    email: 'orlando@bragaconvenience.pt', password: 'admin123'
  })
  return r.token
}

async function loginPos(nif, pin, lojaId, token) {
  const r = await post('/api/auth/pos-login', { nif, pin, lojaId }, token)
  return r.utilizador
}

async function carregarProdutos(token) {
  const lista = await get('/api/catalogo', token)
  const por = ean => lista.find(p => p.ean === ean)?.id
  return {
    leite:   por('5601010010019'),
    leite2:  por('5600618001017'),
    queijo:  por('5601006099001'),
    iogurte: por('5601006112007'),
    cola:    por('5449000000996'),
    agua:    por('5601234567890'),
    sumol:   por('5601235001001'),
    pao:     por('5601009876543'),
    croiss:  por('5601009001234'),
    pring:   por('5601240001001'),
    dove:    por('5601400001001'),
  }
}

async function carregarFornecedores(token) {
  const lista = await get('/api/sync/fornecedores', token)
  const por = nome => lista.find(f => f.nome.includes(nome))?.id
  return {
    norte:   por('Distribuição Norte'),
    lact:    por('Lacticínios'),
    padaria: por('Padaria'),
    limpo:   por('SuperLimpo'),
  }
}

// ─── VENDAS helper ────────────────────────────────────────────────────
// Cada venda individual precisa de lojaId no DTO

function venda(lojaId, opId, diasA, total, mp, linhas) {
  return {
    id: uuid(), lojaId, operadorId: opId,
    dataTransacao: diasAtras(diasA),
    valorTotal: total, metodoPagamento: mp, nifCliente: null, linhas
  }
}

function quebra(lojaId, opId, produtoId, quantidade, valorPerdido, motivo, diasA) {
  return { id: uuid(), lojaId, operadorId: opId, produtoId, quantidade, valorPerdido, motivo, dataRegisto: diasAtras(diasA) }
}

// ─── FRAIÃO ──────────────────────────────────────────────────────────

async function seedFraiao(token, p, f) {
  const lojaId = 2
  const op = await loginPos('223456781', '0000', lojaId, token)
  const opId = op.id
  console.log(`  Operador: ${op.nome} (id=${opId})`)

  // Receções
  await post('/api/sync/rececoes', { lojaId, rececoes: [{
    id: uuid(), operadorId: opId, dataRececao: diasAtras(10),
    documentoReferencia: 'GR-FRAIAO-001', fornecedorId: f.lact,
    linhas: [
      { produtoId: p.leite,   quantidade: 60, lote: 'LOT-ML-F01', dataValidade: dataFutura(45), precoCusto: 0.65 },
      { produtoId: p.leite2,  quantidade: 40, lote: 'LOT-LA-F01', dataValidade: dataFutura(45), precoCusto: 0.60 },
      { produtoId: p.queijo,  quantidade: 30, lote: 'LOT-QF-F01', dataValidade: dataFutura(30), precoCusto: 1.80 },
      { produtoId: p.iogurte, quantidade: 48, lote: 'LOT-IO-F01', dataValidade: dataFutura(20), precoCusto: 0.35 },
    ]
  }]}, token)
  console.log('    ✓ Receção Lacticínios')

  await post('/api/sync/rececoes', { lojaId, rececoes: [{
    id: uuid(), operadorId: opId, dataRececao: diasAtras(8),
    documentoReferencia: 'GR-FRAIAO-002', fornecedorId: f.norte,
    linhas: [
      { produtoId: p.cola,  quantidade: 120, lote: null, dataValidade: null, precoCusto: 0.45 },
      { produtoId: p.agua,  quantidade: 80,  lote: null, dataValidade: null, precoCusto: 0.32 },
      { produtoId: p.sumol, quantidade: 48,  lote: null, dataValidade: null, precoCusto: 0.50 },
      { produtoId: p.pring, quantidade: 36,  lote: null, dataValidade: null, precoCusto: 1.20 },
    ]
  }]}, token)
  console.log('    ✓ Receção Bebidas/Snacks')

  // Vendas
  const vendas = [
    venda(lojaId, opId, 7, 21.35, 1, [{ produtoId: p.cola, quantidade: 6, precoUnitario: 0.89, subtotal: 5.34 }, { produtoId: p.leite, quantidade: 8, precoUnitario: 0.95, subtotal: 7.60 }, { produtoId: p.agua, quantidade: 12, precoUnitario: 0.69, subtotal: 8.28 }]),
    venda(lojaId, opId, 6, 18.70, 2, [{ produtoId: p.cola, quantidade: 10, precoUnitario: 0.89, subtotal: 8.90 }, { produtoId: p.leite2, quantidade: 5, precoUnitario: 0.89, subtotal: 4.45 }, { produtoId: p.iogurte, quantidade: 9, precoUnitario: 0.59, subtotal: 5.31 }]),
    venda(lojaId, opId, 5, 24.90, 1, [{ produtoId: p.cola, quantidade: 12, precoUnitario: 0.89, subtotal: 10.68 }, { produtoId: p.queijo, quantidade: 2, precoUnitario: 2.99, subtotal: 5.98 }, { produtoId: p.agua, quantidade: 12, precoUnitario: 0.69, subtotal: 8.28 }]),
    venda(lojaId, opId, 4, 32.15, 2, [{ produtoId: p.cola, quantidade: 15, precoUnitario: 0.89, subtotal: 13.35 }, { produtoId: p.leite, quantidade: 10, precoUnitario: 0.95, subtotal: 9.50 }, { produtoId: p.pring, quantidade: 2, precoUnitario: 2.49, subtotal: 4.98 }, { produtoId: p.sumol, quantidade: 4, precoUnitario: 0.99, subtotal: 3.96 }]),
    venda(lojaId, opId, 3, 28.40, 3, [{ produtoId: p.cola, quantidade: 14, precoUnitario: 0.89, subtotal: 12.46 }, { produtoId: p.leite, quantidade: 8, precoUnitario: 0.95, subtotal: 7.60 }, { produtoId: p.iogurte, quantidade: 14, precoUnitario: 0.59, subtotal: 8.26 }]),
    venda(lojaId, opId, 2, 35.80, 1, [{ produtoId: p.cola, quantidade: 18, precoUnitario: 0.89, subtotal: 16.02 }, { produtoId: p.agua, quantidade: 15, precoUnitario: 0.69, subtotal: 10.35 }, { produtoId: p.queijo, quantidade: 2, precoUnitario: 2.99, subtotal: 5.98 }, { produtoId: p.leite2, quantidade: 4, precoUnitario: 0.89, subtotal: 3.56 }]),
    venda(lojaId, opId, 1, 41.20, 2, [{ produtoId: p.cola, quantidade: 20, precoUnitario: 0.89, subtotal: 17.80 }, { produtoId: p.leite, quantidade: 12, precoUnitario: 0.95, subtotal: 11.40 }, { produtoId: p.agua, quantidade: 10, precoUnitario: 0.69, subtotal: 6.90 }, { produtoId: p.pring, quantidade: 2, precoUnitario: 2.49, subtotal: 4.98 }]),
    venda(lojaId, opId, 0, 19.50, 1, [{ produtoId: p.cola, quantidade: 8, precoUnitario: 0.89, subtotal: 7.12 }, { produtoId: p.leite, quantidade: 6, precoUnitario: 0.95, subtotal: 5.70 }, { produtoId: p.agua, quantidade: 10, precoUnitario: 0.69, subtotal: 6.90 }]),
  ]
  for (const v of vendas) {
    await post('/api/sync/vendas', { lojaId, vendas: [v] }, token)
  }
  console.log(`    ✓ ${vendas.length} vendas`)

  await post('/api/sync/quebras', { lojaId, quebras: [
    quebra(lojaId, opId, p.iogurte, 6, 2.10, 1, 5),
    quebra(lojaId, opId, p.cola,    3, 1.35, 2, 3),
  ]}, token)
  console.log('    ✓ 2 quebras')
}

// ─── CENTRO ───────────────────────────────────────────────────────────

async function seedCentro(token, p, f) {
  const lojaId = 3
  const op = await loginPos('234567892', '0000', lojaId, token)
  const opId = op.id
  console.log(`  Operador: ${op.nome} (id=${opId})`)

  await post('/api/sync/rececoes', { lojaId, rececoes: [{
    id: uuid(), operadorId: opId, dataRececao: diasAtras(9),
    documentoReferencia: 'GR-CENTRO-001', fornecedorId: f.norte,
    linhas: [
      { produtoId: p.cola,  quantidade: 96, lote: null, dataValidade: null, precoCusto: 0.45 },
      { produtoId: p.agua,  quantidade: 72, lote: null, dataValidade: null, precoCusto: 0.32 },
      { produtoId: p.sumol, quantidade: 48, lote: null, dataValidade: null, precoCusto: 0.50 },
    ]
  }]}, token)
  console.log('    ✓ Receção Bebidas')

  await post('/api/sync/rececoes', { lojaId, rececoes: [{
    id: uuid(), operadorId: opId, dataRececao: diasAtras(6),
    documentoReferencia: 'GR-CENTRO-002', fornecedorId: f.lact,
    linhas: [
      { produtoId: p.leite,   quantidade: 48, lote: 'LOT-ML-C01', dataValidade: dataFutura(40), precoCusto: 0.65 },
      { produtoId: p.iogurte, quantidade: 36, lote: 'LOT-IO-C01', dataValidade: dataFutura(18), precoCusto: 0.35 },
      { produtoId: p.queijo,  quantidade: 24, lote: 'LOT-QF-C01', dataValidade: dataFutura(25), precoCusto: 1.80 },
    ]
  }]}, token)
  console.log('    ✓ Receção Lacticínios')

  const vendas = [
    venda(lojaId, opId, 7, 15.20, 2, [{ produtoId: p.cola, quantidade: 8, precoUnitario: 0.89, subtotal: 7.12 }, { produtoId: p.agua, quantidade: 8, precoUnitario: 0.69, subtotal: 5.52 }, { produtoId: p.sumol, quantidade: 3, precoUnitario: 0.99, subtotal: 2.97 }]),
    venda(lojaId, opId, 6, 22.40, 1, [{ produtoId: p.cola, quantidade: 12, precoUnitario: 0.89, subtotal: 10.68 }, { produtoId: p.leite, quantidade: 6, precoUnitario: 0.95, subtotal: 5.70 }, { produtoId: p.iogurte, quantidade: 10, precoUnitario: 0.59, subtotal: 5.90 }]),
    venda(lojaId, opId, 5, 18.60, 3, [{ produtoId: p.cola, quantidade: 10, precoUnitario: 0.89, subtotal: 8.90 }, { produtoId: p.queijo, quantidade: 2, precoUnitario: 2.99, subtotal: 5.98 }, { produtoId: p.agua, quantidade: 5, precoUnitario: 0.69, subtotal: 3.45 }]),
    venda(lojaId, opId, 4, 26.70, 2, [{ produtoId: p.cola, quantidade: 14, precoUnitario: 0.89, subtotal: 12.46 }, { produtoId: p.sumol, quantidade: 6, precoUnitario: 0.99, subtotal: 5.94 }, { produtoId: p.leite, quantidade: 6, precoUnitario: 0.95, subtotal: 5.70 }]),
    venda(lojaId, opId, 3, 19.90, 1, [{ produtoId: p.cola, quantidade: 10, precoUnitario: 0.89, subtotal: 8.90 }, { produtoId: p.agua, quantidade: 10, precoUnitario: 0.69, subtotal: 6.90 }, { produtoId: p.iogurte, quantidade: 7, precoUnitario: 0.59, subtotal: 4.13 }]),
    venda(lojaId, opId, 2, 31.50, 2, [{ produtoId: p.cola, quantidade: 16, precoUnitario: 0.89, subtotal: 14.24 }, { produtoId: p.queijo, quantidade: 2, precoUnitario: 2.99, subtotal: 5.98 }, { produtoId: p.sumol, quantidade: 6, precoUnitario: 0.99, subtotal: 5.94 }, { produtoId: p.leite, quantidade: 6, precoUnitario: 0.95, subtotal: 5.70 }]),
    venda(lojaId, opId, 1, 29.80, 1, [{ produtoId: p.cola, quantidade: 15, precoUnitario: 0.89, subtotal: 13.35 }, { produtoId: p.agua, quantidade: 12, precoUnitario: 0.69, subtotal: 8.28 }, { produtoId: p.iogurte, quantidade: 14, precoUnitario: 0.59, subtotal: 8.26 }]),
    venda(lojaId, opId, 0, 14.20, 3, [{ produtoId: p.cola, quantidade: 8, precoUnitario: 0.89, subtotal: 7.12 }, { produtoId: p.sumol, quantidade: 4, precoUnitario: 0.99, subtotal: 3.96 }, { produtoId: p.leite, quantidade: 4, precoUnitario: 0.95, subtotal: 3.80 }]),
  ]
  for (const v of vendas) {
    await post('/api/sync/vendas', { lojaId, vendas: [v] }, token)
  }
  console.log(`    ✓ ${vendas.length} vendas`)

  await post('/api/sync/quebras', { lojaId, quebras: [
    quebra(lojaId, opId, p.queijo, 2, 3.60, 1, 4),
  ]}, token)
  console.log('    ✓ 1 quebra')
}

// ─── GUALTAR ──────────────────────────────────────────────────────────

async function seedGualtar(token, p, f) {
  const lojaId = 4
  const op = await loginPos('245678904', '0000', lojaId, token)
  const opId = op.id
  console.log(`  Operador: ${op.nome} (id=${opId})`)

  await post('/api/sync/rececoes', { lojaId, rececoes: [{
    id: uuid(), operadorId: opId, dataRececao: diasAtras(7),
    documentoReferencia: 'GR-GUALTAR-001', fornecedorId: f.padaria,
    linhas: [
      { produtoId: p.pao,    quantidade: 150, lote: 'LOT-PA-G01', dataValidade: dataFutura(2), precoCusto: 0.08 },
      { produtoId: p.croiss, quantidade: 60,  lote: 'LOT-CR-G01', dataValidade: dataFutura(2), precoCusto: 0.25 },
    ]
  }]}, token)
  console.log('    ✓ Receção Padaria')

  await post('/api/sync/rececoes', { lojaId, rececoes: [{
    id: uuid(), operadorId: opId, dataRececao: diasAtras(5),
    documentoReferencia: 'GR-GUALTAR-002', fornecedorId: f.lact,
    linhas: [
      { produtoId: p.leite,   quantidade: 36, lote: 'LOT-ML-G01', dataValidade: dataFutura(42), precoCusto: 0.65 },
      { produtoId: p.iogurte, quantidade: 24, lote: 'LOT-IO-G01', dataValidade: dataFutura(15), precoCusto: 0.35 },
    ]
  }]}, token)
  console.log('    ✓ Receção Lacticínios')

  const vendas = [
    venda(lojaId, opId, 6, 16.80, 1, [{ produtoId: p.pao, quantidade: 40, precoUnitario: 0.15, subtotal: 6.00 }, { produtoId: p.croiss, quantidade: 10, precoUnitario: 0.49, subtotal: 4.90 }, { produtoId: p.leite, quantidade: 6, precoUnitario: 0.95, subtotal: 5.70 }]),
    venda(lojaId, opId, 5, 21.40, 2, [{ produtoId: p.pao, quantidade: 50, precoUnitario: 0.15, subtotal: 7.50 }, { produtoId: p.croiss, quantidade: 12, precoUnitario: 0.49, subtotal: 5.88 }, { produtoId: p.leite, quantidade: 8, precoUnitario: 0.95, subtotal: 7.60 }]),
    venda(lojaId, opId, 4, 18.50, 1, [{ produtoId: p.pao, quantidade: 45, precoUnitario: 0.15, subtotal: 6.75 }, { produtoId: p.iogurte, quantidade: 8, precoUnitario: 0.59, subtotal: 4.72 }, { produtoId: p.leite, quantidade: 7, precoUnitario: 0.95, subtotal: 6.65 }]),
    venda(lojaId, opId, 3, 24.20, 2, [{ produtoId: p.pao, quantidade: 60, precoUnitario: 0.15, subtotal: 9.00 }, { produtoId: p.croiss, quantidade: 14, precoUnitario: 0.49, subtotal: 6.86 }, { produtoId: p.leite, quantidade: 8, precoUnitario: 0.95, subtotal: 7.60 }]),
    venda(lojaId, opId, 2, 19.90, 3, [{ produtoId: p.pao, quantidade: 50, precoUnitario: 0.15, subtotal: 7.50 }, { produtoId: p.iogurte, quantidade: 10, precoUnitario: 0.59, subtotal: 5.90 }, { produtoId: p.leite, quantidade: 7, precoUnitario: 0.95, subtotal: 6.65 }]),
    venda(lojaId, opId, 1, 27.60, 1, [{ produtoId: p.pao, quantidade: 70, precoUnitario: 0.15, subtotal: 10.50 }, { produtoId: p.croiss, quantidade: 16, precoUnitario: 0.49, subtotal: 7.84 }, { produtoId: p.leite, quantidade: 10, precoUnitario: 0.95, subtotal: 9.50 }]),
    venda(lojaId, opId, 0, 12.40, 2, [{ produtoId: p.pao, quantidade: 30, precoUnitario: 0.15, subtotal: 4.50 }, { produtoId: p.croiss, quantidade: 8, precoUnitario: 0.49, subtotal: 3.92 }, { produtoId: p.leite, quantidade: 4, precoUnitario: 0.95, subtotal: 3.80 }]),
  ]
  for (const v of vendas) {
    await post('/api/sync/vendas', { lojaId, vendas: [v] }, token)
  }
  console.log(`    ✓ ${vendas.length} vendas`)

  await post('/api/sync/quebras', { lojaId, quebras: [
    quebra(lojaId, opId, p.pao,     8, 0.64, 1, 2),
    quebra(lojaId, opId, p.iogurte, 4, 1.40, 2, 1),
  ]}, token)
  console.log('    ✓ 2 quebras')
}

// ─── TRANSFERÊNCIAS ───────────────────────────────────────────────────

async function seedTransferencias(token, p) {
  const opFraiao  = (await loginPos('223456781', '0000', 2, token)).id
  const opCentro  = (await loginPos('234567892', '0000', 3, token)).id
  const opGualtar = (await loginPos('245678904', '0000', 4, token)).id

  // Envio Fraião → Gualtar (concluída)
  const envio1Id = uuid()
  await post('/api/sync/transferencias', { lojaId: 2, transferencias: [{
    id: envio1Id, tipoMovimento: 'ENVIO',
    lojaOrigemId: 2, lojaDestinoId: 4, operadorId: opFraiao,
    dataMovimento: diasAtras(4), transferenciaEnvioId: null,
    documentoReferencia: 'GT-F-G-001', observacoes: 'Reforço bebidas',
    linhas: [{ produtoId: p.cola, quantidade: 12 }, { produtoId: p.agua, quantidade: 8 }]
  }]}, token)

  await post('/api/sync/transferencias', { lojaId: 4, transferencias: [{
    id: uuid(), tipoMovimento: 'RECECAO',
    lojaOrigemId: 2, lojaDestinoId: 4, operadorId: opGualtar,
    dataMovimento: diasAtras(3), transferenciaEnvioId: envio1Id,
    documentoReferencia: null, observacoes: null,
    linhas: [{ produtoId: p.cola, quantidade: 12 }, { produtoId: p.agua, quantidade: 8 }]
  }]}, token)
  console.log('    ✓ Fraião→Gualtar (concluída)')

  // Envio Centro → Fraião (em trânsito)
  await post('/api/sync/transferencias', { lojaId: 3, transferencias: [{
    id: uuid(), tipoMovimento: 'ENVIO',
    lojaOrigemId: 3, lojaDestinoId: 2, operadorId: opCentro,
    dataMovimento: diasAtras(1), transferenciaEnvioId: null,
    documentoReferencia: 'GT-C-F-001', observacoes: null,
    linhas: [{ produtoId: p.sumol, quantidade: 12 }]
  }]}, token)
  console.log('    ✓ Centro→Fraião (em trânsito)')
}

// ─── FECHOS DE CAIXA ──────────────────────────────────────────────────

async function seedFechos(token) {
  const opFraiao  = (await loginPos('223456781', '0000', 2, token)).id
  const opCentro  = (await loginPos('234567892', '0000', 3, token)).id
  const opGualtar = (await loginPos('245678904', '0000', 4, token)).id

  await post('/api/sync/fechos', { lojaId: 2, fechos: [{
    id: uuid(), lojaId: 2, operadorId: opFraiao, dataFecho: diasAtras(1),
    teoricoNumerario: 87.40, teoricoMultibanco: 124.60, teoricoMbway: 38.00, teoricoTotal: 250.00,
    contadoNumerario: 87.40, contadoMultibanco: 124.60, contadoMbway: 38.00, contadoTotal: 250.00,
    discrepancia: 0.00, temDiscrepancia: false, justificacao: null
  }]}, token)
  console.log('    ✓ Fecho Fraião (equilibrado)')

  await post('/api/sync/fechos', { lojaId: 3, fechos: [{
    id: uuid(), lojaId: 3, operadorId: opCentro, dataFecho: diasAtras(1),
    teoricoNumerario: 55.20, teoricoMultibanco: 82.30, teoricoMbway: 15.50, teoricoTotal: 153.00,
    contadoNumerario: 50.20, contadoMultibanco: 82.30, contadoMbway: 15.50, contadoTotal: 148.00,
    discrepancia: -5.00, temDiscrepancia: true,
    justificacao: 'Diferença apurada na contagem de notas — possível troco errado.'
  }]}, token)
  console.log('    ✓ Fecho Centro (discrepância -5€)')

  await post('/api/sync/fechos', { lojaId: 4, fechos: [{
    id: uuid(), lojaId: 4, operadorId: opGualtar, dataFecho: diasAtras(2),
    teoricoNumerario: 62.10, teoricoMultibanco: 45.80, teoricoMbway: 12.00, teoricoTotal: 119.90,
    contadoNumerario: 62.10, contadoMultibanco: 45.80, contadoMbway: 12.00, contadoTotal: 119.90,
    discrepancia: 0.00, temDiscrepancia: false, justificacao: null
  }]}, token)
  console.log('    ✓ Fecho Gualtar (equilibrado)')
}

// ─── MAIN ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════')
  console.log(' BIS — Seed automático via API REST')
  console.log('═══════════════════════════════════════\n')

  console.log('🔑 Login como admin...')
  const token = await login()
  console.log('✓ Token obtido\n')

  console.log('📦 A carregar IDs de produtos e fornecedores...')
  const p = await carregarProdutos(token)
  const f = await carregarFornecedores(token)
  const nulls = Object.entries(p).filter(([,v]) => !v).map(([k]) => k)
  if (nulls.length) console.warn(`⚠  Produtos não encontrados: ${nulls.join(', ')}`)
  else console.log('✓ Todos os IDs carregados\n')

  console.log('🏪 Fraião (lojaId=2)...')
  await seedFraiao(token, p, f)
  console.log()

  console.log('🏪 Centro (lojaId=3)...')
  await seedCentro(token, p, f)
  console.log()

  console.log('🏪 Gualtar (lojaId=4)...')
  await seedGualtar(token, p, f)
  console.log()

  console.log('🔄 Transferências...')
  await seedTransferencias(token, p)
  console.log()

  console.log('💰 Fechos de caixa...')
  await seedFechos(token)
  console.log()

  // Verificação final
  const inv = await get('/api/inventario', token).catch(() => null)
  if (inv) {
    console.log('📊 Stock resultante na Sede:')
    const cols = inv.lojas.map(l => l.nome)
    for (const a of inv.artigos.filter(a => a.total > 0).slice(0, 10)) {
      const stocks = inv.lojas.map(l => `${l.nome}: ${a.stockPorLoja[l.id] ?? 0}`).join(' | ')
      console.log(`   ${a.artigo.padEnd(30)} ${stocks}`)
    }
  }

  console.log()
  console.log('═══════════════════════════════════════')
  console.log(' ✅ Seed concluído com sucesso!')
  console.log(' → Backoffice → Inventário para confirmar')
  console.log('═══════════════════════════════════════')
}

main().catch(err => {
  console.error('\n❌ Erro:', err.message)
  process.exit(1)
})
