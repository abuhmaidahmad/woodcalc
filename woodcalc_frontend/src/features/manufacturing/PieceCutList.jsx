import React, { useState } from 'react'
import { groupPieces } from '../kitchen_planner/machining/pieces'
import { useTranslation } from '../../i18n/LanguageContext'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

// The saw operator's cut list: pieces grouped by name + size + material with a
// quantity; a row opens to list the IDs of the pieces in it (with each one's
// cabinet), the same IDs printed on the labels and used for the CNC files.
export default function PieceCutList({ pieces }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState({})
  const groups = groupPieces(pieces)
  const byId = new Map(pieces.map(p => [p.id, p]))
  const cell = { padding: '10px 16px', fontSize: 12, color: DARK, textAlign: 'start' }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr style={{ background: '#FAFAFA' }}>
        {['', t('pieceCutList.colPart'), t('pieceCutList.colSize'), t('pieceCutList.colMaterial'), t('pieceCutList.colQty')].map((h, i) => (
          <th key={i} style={{ ...cell, fontSize: 11, fontWeight: 600, color: '#888' }}>{h}</th>
        ))}
      </tr></thead>
      <tbody>
        {groups.map(g => (
          <React.Fragment key={g.key}>
            <tr onClick={() => setOpen(o => ({ ...o, [g.key]: !o[g.key] }))} data-group={g.key}
              style={{ borderBottom: '1px solid #F7F4F0', cursor: 'pointer', background: open[g.key] ? ACCENT + '0D' : '#fff' }}
              title={open[g.key] ? t('pieceCutList.hideIds') : t('pieceCutList.showIds')}>
              <td style={{ ...cell, width: 16, color: '#888' }}>{open[g.key] ? '▾' : '▸'}</td>
              <td style={cell}>{g.label}</td>
              <td style={{ ...cell, fontFamily: 'monospace' }}>{g.length} × {g.width} × {g.thickness}</td>
              <td style={{ ...cell, color: '#666' }}>{g.sku || g.materialName}</td>
              <td style={{ ...cell, fontWeight: 700, color: ACCENT }}>{g.quantity}</td>
            </tr>
            {open[g.key] && (
              <tr style={{ background: '#FDFAF6', borderBottom: '1px solid #F0EBE5' }}>
                <td />
                <td colSpan={4} style={{ ...cell, paddingTop: 6, paddingBottom: 10 }}>
                  {g.ids.map(id => (
                    <div key={id} data-piece-id={id} style={{ display: 'flex', gap: 12, fontSize: 11, lineHeight: '18px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{id}</span>
                      <span style={{ color: '#888' }}>{byId.get(id)?.cabinet}</span>
                    </div>
                  ))}
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  )
}
