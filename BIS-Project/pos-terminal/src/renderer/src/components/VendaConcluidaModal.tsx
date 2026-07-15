/**
 * VendaConcluidaModal — Modal de sucesso após registar a venda (Fase 3.3).
 *
 * Mostra:
 *   - Banner verde de sucesso com nº mock da venda + método + data/hora
 *   - 3 caixas: Total / Recebido / Troco (formatos por método)
 *   - Selecção de tipo de documento (Fatura Simplificada / Com NIF / Registo Interno)
 *   - Input opcional de NIF (mock — não vai à BD)
 *   - Botões: Imprimir (preview popup) / Nova Venda
 *
 * Mocks honestos:
 *   - Nº de venda calculado client-side (formato 2026-NNNNN)
 *   - NIF capturado mas não persistido
 *   - Recibo gerado é HTML com estilo de talão para print preview
 */

import { useMemo, useState } from 'react'
import { MetodoPagamento, OperadorSessao } from '../../../shared/types'
import { ResultadoPagamento } from './PagamentoModal'

// ─── Tipos ─────────────────────────────────────────────────────────

type TipoDocumento = 'fatura-simplificada' | 'fatura-nif' | 'registo-interno'

interface LinhaVendida {
  artigo:     string
  quantidade: number
  pvp:        number
  subtotal:   number
  taxaIVA:    number
}

interface VendaConcluidaModalProps {
  vendaId:        string
  total:          number
  resultado:      ResultadoPagamento
  linhas:         LinhaVendida[]
  operador:       OperadorSessao
  onNovaVenda:    () => void
}

// ─── Helpers de apresentação ───────────────────────────────────────

/** Gera nº mock formato "2026-NNNNN" a partir do UUID + timestamp */
function gerarNumeroVenda(vendaId: string): string {
  const ano = new Date().getFullYear()
  // Converte primeiros 4 chars do UUID em base16 → número, para parecer realista
  const num = parseInt(vendaId.replace(/-/g, '').slice(0, 4), 16) % 100000
  return `${ano}-${num.toString().padStart(5, '0')}`
}

/** Formata o "Recebido" conforme o método */
function formatarRecebido(r: ResultadoPagamento): string {
  switch (r.metodo) {
    case MetodoPagamento.Numerario:
      return `${(r.valorRecebido ?? 0).toFixed(2)} €`
    case MetodoPagamento.Multibanco:
      return r.cartaoMock ?? 'Cartão Multibanco'
    case MetodoPagamento.MBWay:
      const tlm = r.telemovel ?? ''
      return `MBWay · ${tlm.match(/.{1,3}/g)?.join(' ') ?? tlm}`
  }
}

function calcularTroco(r: ResultadoPagamento, total: number): number | null {
  if (r.metodo !== MetodoPagamento.Numerario) return null
  const recebido = r.valorRecebido ?? 0
  return Math.max(0, Math.round((recebido - total) * 100) / 100)
}

function nomeMetodo(metodo: MetodoPagamento): string {
  switch (metodo) {
    case MetodoPagamento.Numerario:  return 'Numerário'
    case MetodoPagamento.Multibanco: return 'Multibanco'
    case MetodoPagamento.MBWay:      return 'MBWay'
  }
}

// ═══════════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════════

export function VendaConcluidaModal({
  vendaId,
  total,
  resultado,
  linhas,
  operador,
  onNovaVenda
}: VendaConcluidaModalProps) {
  const [tipoDoc, setTipoDoc] = useState<TipoDocumento>('fatura-simplificada')
  const [nifInput, setNifInput] = useState('')
  const [mostrarRecibo, setMostrarRecibo] = useState(false)

  const numeroVenda = useMemo(() => gerarNumeroVenda(vendaId), [vendaId])
  const dataAgora   = useMemo(() => new Date(), [])
  const dataLegivel = dataAgora.toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
  const horaLegivel = dataAgora.toLocaleTimeString('pt-PT', {
    hour: '2-digit', minute: '2-digit'
  })

  const recebidoFormatado = formatarRecebido(resultado)
  const troco = calcularTroco(resultado, total)

  const nifValido = /^\d{9}$/.test(nifInput)
  const podeImprimir = tipoDoc !== 'fatura-nif' || nifValido

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-8">

          {/* ─── Banner verde de sucesso ─── */}
          <div className="bg-emerald-600 text-white px-6 py-5 flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-emerald-600 text-3xl font-bold flex-shrink-0">
              ✓
            </div>
            <div className="flex-1">
              <div className="text-xl font-bold">Venda concluída com sucesso!</div>
              <div className="text-sm text-emerald-100 mt-0.5">
                Venda Nº {numeroVenda} · {nomeMetodo(resultado.metodo)} · {dataLegivel} · {horaLegivel}
              </div>
            </div>
          </div>

          {/* ─── Body ─── */}
          <div className="p-6 space-y-5">

            {/* 3 caixas: Total / Recebido / Troco */}
            <div className="grid grid-cols-3 gap-3">
              <CaixaInfo label="Total Pago" valor={`${total.toFixed(2)} €`} cor="slate" />
              <CaixaInfo label="Recebido"   valor={recebidoFormatado}        cor="blue" />
              <CaixaInfo
                label="Troco"
                valor={troco !== null ? `${troco.toFixed(2)} €` : '—'}
                cor={troco !== null && troco > 0 ? 'emerald' : 'slate'}
              />
            </div>

            {/* Emissão de documento */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Emissão de documento</h3>
              <div className="space-y-2">
                <RadioDoc
                  selected={tipoDoc === 'fatura-simplificada'}
                  onClick={() => setTipoDoc('fatura-simplificada')}
                  icone="📄"
                  titulo="Fatura Simplificada"
                  descricao="Sem NIF do cliente · emitida automaticamente"
                />
                <RadioDoc
                  selected={tipoDoc === 'fatura-nif'}
                  onClick={() => setTipoDoc('fatura-nif')}
                  icone="👤"
                  titulo="Fatura com NIF"
                  descricao="Associar NIF do cliente a esta venda"
                />
                <RadioDoc
                  selected={tipoDoc === 'registo-interno'}
                  onClick={() => setTipoDoc('registo-interno')}
                  icone="📝"
                  titulo="Apenas Registo Interno"
                  descricao="Sem documento fiscal · só registo da operação"
                />
              </div>

              {/* Input NIF (só se "Fatura com NIF") */}
              {tipoDoc === 'fatura-nif' && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <label className="block text-xs font-semibold text-blue-900 mb-1.5 uppercase tracking-wide">
                    NIF do cliente (9 dígitos)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={nifInput}
                    onChange={(e) => setNifInput(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    placeholder="Ex: 503456789"
                    className={`w-full px-3 py-2 text-lg font-mono tracking-wider border-2 rounded-lg focus:outline-none ${
                      nifValido
                        ? 'border-emerald-400 bg-white'
                        : nifInput.length > 0
                          ? 'border-amber-400 bg-white'
                          : 'border-blue-300 bg-white'
                    }`}
                  />
                  {!nifValido && nifInput.length > 0 && (
                    <div className="text-xs text-amber-700 mt-1.5">
                      ⚠ NIF deve ter 9 dígitos ({nifInput.length}/9)
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMostrarRecibo(true)}
                disabled={!podeImprimir}
                className="bg-slate-700 hover:bg-slate-800 active:bg-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <span className="text-2xl">🖨</span>
                <span>Imprimir Recibo</span>
              </button>

              <button
                type="button"
                onClick={onNovaVenda}
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-4 rounded-xl text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <span className="text-2xl">←</span>
                <span>Nova Venda</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Pre-view de Recibo ─── */}
      {mostrarRecibo && (
        <ReciboPreview
          numeroVenda={numeroVenda}
          tipoDoc={tipoDoc}
          nif={tipoDoc === 'fatura-nif' ? nifInput : null}
          dataLegivel={dataLegivel}
          horaLegivel={horaLegivel}
          operador={operador}
          linhas={linhas}
          total={total}
          resultado={resultado}
          troco={troco}
          onFechar={() => setMostrarRecibo(false)}
        />
      )}
    </>
  )
}

// ═══════════════════════ Sub-componentes ═══════════════════════

interface CaixaInfoProps {
  label: string
  valor: string
  cor:   'slate' | 'blue' | 'emerald'
}

function CaixaInfo({ label, valor, cor }: CaixaInfoProps) {
  const cores = {
    slate:   { bg: 'bg-slate-100',   border: 'border-slate-200',   text: 'text-slate-900',   sub: 'text-slate-600' },
    blue:    { bg: 'bg-blue-50',     border: 'border-blue-200',    text: 'text-blue-900',    sub: 'text-blue-700' },
    emerald: { bg: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-900', sub: 'text-emerald-700' }
  }[cor]

  return (
    <div className={`${cores.bg} ${cores.border} border-2 rounded-xl p-3 text-center`}>
      <div className={`text-xs font-semibold uppercase tracking-wide ${cores.sub}`}>{label}</div>
      <div className={`text-xl font-bold mt-1 tabular-nums ${cores.text}`}>{valor}</div>
    </div>
  )
}

interface RadioDocProps {
  selected:    boolean
  onClick:     () => void
  icone:       string
  titulo:      string
  descricao:   string
}

function RadioDoc({ selected, onClick, icone, titulo, descricao }: RadioDocProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all text-left ${
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="text-2xl">{icone}</div>
      <div className="flex-1">
        <div className={`font-semibold ${selected ? 'text-blue-900' : 'text-slate-900'}`}>{titulo}</div>
        <div className={`text-xs ${selected ? 'text-blue-700' : 'text-slate-500'}`}>{descricao}</div>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
        selected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
      }`}>
        {selected && <div className="w-2 h-2 bg-white rounded-full" />}
      </div>
    </button>
  )
}

// ═══════════════════════ Recibo (Pre-view popup) ═══════════════════════

interface ReciboPreviewProps {
  numeroVenda: string
  tipoDoc:     TipoDocumento
  nif:         string | null
  dataLegivel: string
  horaLegivel: string
  operador:    OperadorSessao
  linhas:      LinhaVendida[]
  total:       number
  resultado:   ResultadoPagamento
  troco:       number | null
  onFechar:    () => void
}

function ReciboPreview({
  numeroVenda, tipoDoc, nif, dataLegivel, horaLegivel,
  operador, linhas, total, resultado, troco, onFechar
}: ReciboPreviewProps) {

  const tipoDocNome = {
    'fatura-simplificada': 'FATURA SIMPLIFICADA',
    'fatura-nif':          'FATURA',
    'registo-interno':     'REGISTO INTERNO'
  }[tipoDoc]

  // Nº fictício de fatura/registo
  const docNumero = `FT ${numeroVenda}`

  // IVA calculado por linha
  const ivaDetalhes = linhas.map(l => ({
    taxa: l.taxaIVA ?? 23,
    valor: Math.round(l.subtotal * (l.taxaIVA ?? 23) / (100 + (l.taxaIVA ?? 23)) * 100) / 100
  }))
  const taxaIva  = Math.round(ivaDetalhes.reduce((s, i) => s + i.valor, 0) * 100) / 100
  const subtotal = Math.round((total - taxaIva) * 100) / 100
  const taxasUnicas = [...new Set(ivaDetalhes.map(i => i.taxa))]
  const ivaLabel = taxasUnicas.length === 1 ? `IVA (${taxasUnicas[0]}%)` : 'IVA (misto)'

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onFechar}
    >
      <div
        className="bg-slate-200 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between flex-shrink-0">
          <div className="text-sm font-semibold">📄 Pré-visualização do Recibo</div>
          <button
            type="button"
            onClick={onFechar}
            className="text-slate-400 hover:text-white text-xl leading-none px-1"
          >
            ×
          </button>
        </div>

        {/* "Papel" do recibo */}
        <div className="flex-1 overflow-y-auto bg-slate-200 p-4">
          <div className="bg-white rounded shadow-md mx-auto max-w-[300px] p-5 font-mono text-xs text-slate-900 leading-relaxed">
            {/* Cabeçalho da loja */}
            <div className="text-center border-b border-dashed border-slate-400 pb-3 mb-3">
              <div className="font-bold text-base">BragaConvenience</div>
              <div className="text-[10px]">{operador.lojaBaseNome}</div>
              <div className="text-[10px] mt-1">NIF Empresa: 500 000 000</div>
            </div>

            {/* Tipo doc + número */}
            <div className="text-center mb-3">
              <div className="font-bold tracking-widest">{tipoDocNome}</div>
              <div className="mt-1">{docNumero}</div>
              <div className="mt-1 text-[10px]">{dataLegivel} · {horaLegivel}</div>
            </div>

            {/* NIF cliente se aplicável */}
            {tipoDoc === 'fatura-nif' && nif && (
              <div className="border-t border-dashed border-slate-400 pt-2 mb-3 text-[10px]">
                <div>Cliente NIF: {nif}</div>
              </div>
            )}

            {/* Linhas */}
            <div className="border-t border-dashed border-slate-400 pt-2 space-y-1">
              {linhas.map((l, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="font-semibold">{l.artigo}</div>
                  <div className="flex justify-between text-[10px]">
                    <span>  {l.quantidade} × {l.pvp.toFixed(2)} €</span>
                    <span className="font-semibold">{l.subtotal.toFixed(2)} €</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totais */}
            <div className="border-t border-dashed border-slate-400 mt-3 pt-2 space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{subtotal.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span>{ivaLabel}</span>
                <span>{taxaIva.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between font-bold text-base mt-1 pt-1 border-t border-slate-400">
                <span>TOTAL</span>
                <span>{total.toFixed(2)} €</span>
              </div>
            </div>

            {/* Pagamento */}
            <div className="border-t border-dashed border-slate-400 mt-3 pt-2 space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Forma de pagamento</span>
                <span className="font-semibold">{nomeMetodo(resultado.metodo)}</span>
              </div>
              <div className="flex justify-between">
                <span>Recebido</span>
                <span>{formatarRecebido(resultado)}</span>
              </div>
              {troco !== null && troco > 0 && (
                <div className="flex justify-between">
                  <span>Troco</span>
                  <span>{troco.toFixed(2)} €</span>
                </div>
              )}
            </div>

            {/* Operador + footer */}
            <div className="border-t border-dashed border-slate-400 mt-3 pt-2 text-center text-[10px] space-y-1">
              <div>Operador: {operador.nome}</div>
              <div className="font-bold mt-2">Obrigado pela sua visita!</div>
              <div className="text-[9px] text-slate-500">www.bragaconvenience.pt</div>
            </div>
          </div>

          <div className="text-center text-xs text-slate-500 mt-3 italic">
            * Pré-visualização para fins de demonstração
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-300 px-4 py-3 flex-shrink-0">
          <button
            type="button"
            onClick={onFechar}
            className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            Fechar pré-visualização
          </button>
        </div>
      </div>
    </div>
  )
}
