import React, { useState } from 'react'
import { cncExport, cncZip } from '../kitchen_planner/machining/cncExport'
import { useTranslation } from '../../i18n/LanguageContext'
import { loadCompanyStandards } from '../../api/companySettings'

function download(bytes, name) {
  const url = window.URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  window.URL.revokeObjectURL(url)
}

// "Export CNC (DXF)" for one work order: a ZIP of one DXF per piece, named by
// its piece ID, plus parts.csv. Any machining problems buildMachining found are
// listed first, and the file is only made once someone chooses to go ahead.
// loadRoom() returns the work order's room (or null when it has none).
export default function CncExportButton({ workOrder, loadRoom, style }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [review, setReview] = useState(null) // { errors, files }
  const [message, setMessage] = useState('')
  const zipName = `${workOrder?.order_number || 'work_order'}_CNC.zip`

  const start = async () => {
    setMessage(''); setReview(null); setBusy(true)
    try {
      const room = workOrder?.room_id_ref ? await loadRoom() : null
      if (!room) { setMessage(t('cncExport.noRoom')); return }
      await loadCompanyStandards()
      const out = cncExport(workOrder, room)
      if (out.pieces.length === 0) { setMessage(t('cncExport.noPieces')); return }
      if (out.errors.length) { setReview(out); return }
      download(cncZip(out.files), zipName)
      setMessage(t('cncExport.done', { count: out.pieces.length }))
    } catch (e) {
      setMessage(`${t('cncExport.failed')}: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const exportAnyway = () => {
    download(cncZip(review.files), zipName)
    setMessage(t('cncExport.done', { count: review.files.length - 1 }))
    setReview(null)
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <button onClick={start} disabled={busy || !workOrder} data-cnc-export
        style={{ padding: '6px 12px', background: '#fff', color: '#2c3e50', border: '1px solid #2c3e50', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, ...style }}>
        {busy ? t('cncExport.working') : t('cncExport.button')}
      </button>
      {message && <div style={{ fontSize: 11, color: '#888' }}>{message}</div>}
      {review && (
        <div role="alert" style={{ textAlign: 'start', maxWidth: 420, background: '#FFF8E6', border: '1.5px solid #F0C36D', borderRadius: 8, padding: 12, fontSize: 12 }}>
          <div style={{ fontWeight: 700, color: '#8A5A00', marginBottom: 6 }}>{t('cncExport.errorsTitle', { count: review.errors.length })}</div>
          <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 10 }}>
            {review.errors.map((e, i) => (
              <div key={i} data-cnc-error style={{ marginBottom: 4 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{e.id}</span> — {e.message}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setReview(null)} style={{ padding: '5px 10px', border: '1px solid #ddd', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>{t('cncExport.cancel')}</button>
            <button onClick={exportAnyway} style={{ padding: '5px 10px', border: 'none', background: '#C0392B', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>{t('cncExport.exportAnyway')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
