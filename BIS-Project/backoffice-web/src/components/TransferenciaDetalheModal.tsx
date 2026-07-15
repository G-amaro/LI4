/**
 * TransferenciaDetalheModal.tsx — Modal com detalhe completo de uma transferência.
 *
 * Layout: cabeçalho com info do envio/recepção lado a lado, seguido de
 * tabela de linhas com colunas comparativas (enviado vs recebido).
 */

import { useEffect, useState } from 'react'
import { obterDetalheTransferencia } from '../services/transferencias'
import type { TransferenciaDetalhe } from '../services/transferencias'

interface Props {
  envioId: string
  onClose: () => void
}

export function TransferenciaDetalheModal({ envioId, onClose }: Props) {
  const [detalhe, setDetalhe] = useState<TransferenciaDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro]       = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    obterDetalheTransferencia(envioId)
      .then((d) => { if (!cancelado) { setDetalhe(d); setLoading(false) } })
      .catch((e) => { if (!cancelado) { setErro((e as Error).message); setLoading(false) } })
    return () => { cancelado = true }
  }, [envioId])

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Detalhe da Transferência
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{envioId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl px-2"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-12 text-slate-500">A carregar...</div>
          )}

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              Erro: {erro}
            </div>
          )}

          {detalhe && (
            <div className="space-y-6">
              {/* Status badge */}
              <div className="flex items-center gap-3">
                <StatusBadge status={detalhe.status} />
                {detalhe.documentoReferencia && (
                  <span className="text-sm text-slate-600">
                    Documento: <span className="font-mono">{detalhe.documentoReferencia}</span>
                  </span>
                )}
              </div>

              {/* Cards lado a lado: ENVIO + RECEPÇÃO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Envio */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-blue-600">📤</span>
                    <h3 className="font-semibold text-blue-900">Envio</h3>
                  </div>
                  <Field label="Loja origem" value={detalhe.lojaOrigemNome} />
                  <Field label="Data" value={new Date(detalhe.dataEnvio).toLocaleString('pt-PT')} />
                  {detalhe.operadorEnvioNome && (
                    <Field label="Operador" value={detalhe.operadorEnvioNome} />
                  )}
                  {detalhe.observacoesEnvio && (
                    <Field label="Observações" value={detalhe.observacoesEnvio} />
                  )}
                </div>

                {/* Recepção */}
                {detalhe.rececaoId ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-green-600">📥</span>
                      <h3 className="font-semibold text-green-900">Recepção</h3>
                    </div>
                    <Field label="Loja destino" value={detalhe.lojaDestinoNome} />
                    <Field
                      label="Data"
                      value={detalhe.dataRececao ? new Date(detalhe.dataRececao).toLocaleString('pt-PT') : '—'}
                    />
                    {detalhe.operadorRececaoNome && (
                      <Field label="Operador" value={detalhe.operadorRececaoNome} />
                    )}
                    {detalhe.observacoesRececao && (
                      <Field label="Observações" value={detalhe.observacoesRececao} />
                    )}
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                    <div className="text-3xl mb-2">⏳</div>
                    <div className="font-semibold text-amber-900">Em trânsito</div>
                    <div className="text-xs text-amber-700 mt-1">
                      Destino: {detalhe.lojaDestinoNome}
                    </div>
                    <div className="text-xs text-amber-600 mt-2">
                      Aguarda confirmação na loja destino
                    </div>
                  </div>
                )}
              </div>

              {/* Tabela de linhas comparativa */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Artigos</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Artigo</th>
                        <th className="text-right px-4 py-2 font-medium">Enviadas</th>
                        <th className="text-right px-4 py-2 font-medium">Recebidas</th>
                        <th className="text-right px-4 py-2 font-medium">Diferença</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {detalhe.linhas.map((l) => (
                        <tr key={l.produtoId}>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-slate-900">{l.artigo}</div>
                            <div className="text-xs text-slate-500 font-mono">{l.ean}</div>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">
                            {l.quantidadeEnviada}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {l.quantidadeRecebida == null ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <span className="text-slate-900">{l.quantidadeRecebida}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {l.quantidadeRecebida == null ? (
                              <span className="text-slate-400">—</span>
                            ) : l.diferenca === 0 ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <span className="text-red-600 font-semibold">−{l.diferenca}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-5 py-2 rounded-lg"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm mb-1.5">
      <span className="text-slate-500">{label}:</span>{' '}
      <span className="text-slate-900">{value}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: 'EmTransito' | 'Recebida' | 'Divergencia' }) {
  if (status === 'Recebida') {
    return (
      <span className="bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
        ✓ Recebida
      </span>
    )
  }
  if (status === 'Divergencia') {
    return (
      <span className="bg-red-100 text-red-800 text-xs font-semibold px-3 py-1 rounded-full">
        ⚠ Divergência
      </span>
    )
  }
  return (
    <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1 rounded-full">
      ⏳ Em trânsito
    </span>
  )
}
