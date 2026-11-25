import React from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import { getWallThickness } from './wallGeometry'

const ACCENT = '#C8902A'

export const ROOM_ELEMENTS = [
  { type: 'window',   label: 'Window',         labelKey: 'kitchenPlannerModule.elWindow',        icon: '🪟', color: '#87CEEB', w: 900,  h: 1200 },
  { type: 'door',     label: 'Door',           labelKey: 'kitchenPlannerModule.elDoor',           icon: '🚪', color: '#DEB887', w: 900,  h: 2300 },
  { type: 'electric', label: 'Electric Point', labelKey: 'kitchenPlannerModule.elElectricPoint',  icon: '⚡', color: '#FFD700', w: 100,  h: 100  },
  { type: 'water',    label: 'Water Supply',   labelKey: 'kitchenPlannerModule.elWaterSupply',    icon: '💧', color: '#4FC3F7', w: 100,  h: 100  },
  { type: 'drain',    label: 'Drain Point',    labelKey: 'kitchenPlannerModule.elDrainPoint',     icon: '🕳',  color: '#90A4AE', w: 100,  h: 100  },
  { type: 'gas',      label: 'Gas Point',      labelKey: 'kitchenPlannerModule.elGasPoint',       icon: '🔥', color: '#FF7043', w: 100,  h: 100  },
  { type: 'column',   label: 'Column',         labelKey: 'kitchenPlannerModule.elColumn',         icon: '⬛', color: '#9E9E9E', w: 300,  h: 300  },
]

export function RoomElementPalette({ items, onAdd, styles: s }) {
  const { t } = useTranslation()
  return items.map(el => (
    <div key={el.type} onClick={() => onAdd(el)} style={s.elementItem}
      onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#E0DAD4'}>
      <span style={{ fontSize: 18 }}>{el.icon}</span>
      <div><div style={s.elementLabel}>{t(el.labelKey)}</div><div style={s.elementSize}>{el.w}×{el.h}mm</div></div>
    </div>
  ))
}

export function ElementProperties({ el, walls, scale, styles: s, onChange, onDelete }) {
  const { t } = useTranslation()
  return (
      <div>
        <div style={s.propTitle}>{el.icon} {el.label}</div>

        <div style={s.propSection}>{t('kitchenPlannerModule.dimensions')}</div>
        <div style={{ marginBottom: 10 }}><div style={s.propLabel}>{t('kitchenPlannerModule.widthLabel')}</div><input type="number" value={el.w} onChange={e => onChange('w', +e.target.value)} style={s.propInput} /></div>
        <div style={{ marginBottom: 10 }}><div style={s.propLabel}>{t('kitchenPlannerModule.heightLabel')}</div><input type="number" value={el.h} onChange={e => onChange('h', +e.target.value)} style={s.propInput} /></div>

        <div style={s.propSection}>{t('kitchenPlannerModule.position')}</div>
        <div style={{ marginBottom: 10 }}>
          <div style={s.propLabel}>{t('kitchenPlannerModule.surface')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['wall', 'floor'].map(surface => (
              <button key={surface} onClick={() => onChange('surface', surface)}
                style={{ flex: 1, padding: '6px', border: `1.5px solid ${(el.surface || 'wall') === surface ? ACCENT : '#E0DAD4'}`,
                  borderRadius: 6, background: (el.surface || 'wall') === surface ? ACCENT+'18' : '#fff',
                  color: (el.surface || 'wall') === surface ? ACCENT : '#666',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {surface === 'wall' ? t('kitchenPlannerModule.surfaceWall') : t('kitchenPlannerModule.surfaceFloor')}
              </button>
            ))}
          </div>
        </div>

        {el.embeddedInWall && walls[el.wallIndex] !== undefined ? (() => {
          const w = walls[el.wallIndex]
          const dx = w.x2 - w.x1, dy = w.y2 - w.y1
          const wallLenPx = Math.hypot(dx, dy)
          const wallLenMm = Math.round(wallLenPx / scale)
          const ux = dx / wallLenPx, uy = dy / wallLenPx
          const ex = el.x * scale - w.x1, ey = el.y * scale - w.y1
          const distMm = Math.round((ex * ux + ey * uy) / scale)
          const wallThicknessLocal = getWallThickness(w)
          const perpX = -uy, perpY = ux
          const perpDistPx = ex * perpX + ey * perpY
          return (
            <>
              <div style={{ marginBottom: 6, padding: '6px 8px', background: '#F0FFF4', borderRadius: 6, fontSize: 11, color: '#2AC87A', fontWeight: 600 }}>
                {t('kitchenPlannerModule.wallInfo', { n: (el.wallIndex || 0) + 1, len: wallLenMm })}
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={s.propLabel}>{t('kitchenPlannerModule.distFromWallStart')}</div>
                <input type="number" value={distMm} min={0} max={Math.max(0, wallLenMm + wallThicknessLocal)}
                  onChange={e => {
                    const newDistPx = (+e.target.value) * scale
                    const newX = (w.x1 + ux * newDistPx + perpX * perpDistPx) / scale
                    const newY = (w.y1 + uy * newDistPx + perpY * perpDistPx) / scale
                    onChange('x', newX)
                    onChange('y', newY)
                  }}
                  style={s.propInput} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={s.propLabel}>{t('kitchenPlannerModule.elevationFromFloor')}</div>
                <input type="number" value={el.elevation || 0}
                  onChange={e => onChange('elevation', +e.target.value)}
                  style={s.propInput} />
              </div>
            </>
          )
        })() : (
          <>
            <div style={{ marginBottom: 10 }}>
              <div style={s.propLabel}>{t('kitchenPlannerModule.distFromLeft')}</div>
              <input type="number" value={Math.round((el.x || 0))}
                onChange={e => onChange('x', +e.target.value)}
                style={s.propInput} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={s.propLabel}>{t('kitchenPlannerModule.distFromTop')}</div>
              <input type="number" value={Math.round((el.y || 0))}
                onChange={e => onChange('y', +e.target.value)}
                style={s.propInput} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={s.propLabel}>{t('kitchenPlannerModule.elevationFromFloor')}</div>
              <input type="number" value={el.elevation || 0}
                onChange={e => onChange('elevation', +e.target.value)}
                style={s.propInput} />
            </div>
          </>
        )}


        {el.type !== 'window' && el.type !== 'door' && (
          <div style={{ marginBottom: 10 }}>
            <div style={s.propLabel}>{t('kitchenPlannerModule.rotationDeg')}</div>
            <input type="number" min={0} max={359} value={el.rotation || 0}
              onChange={e => onChange('rotation', (+e.target.value + 360) % 360)} style={s.propInput} />
          </div>
        )}

        <button onClick={onDelete} style={s.deleteBtn}>{t('kitchenPlannerModule.deleteBtn')}</button>
      </div>

  )
}
