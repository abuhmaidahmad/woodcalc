import { useTranslation } from '../../i18n/LanguageContext'
import { buildZonePresets } from './formulaEngine'

function ZoneVisual({ zones, scale = 0.16 }) {
  // zones is top-to-bottom (zones[0] = topmost front) -- plain 'column' stacks
  // DOM order top-to-bottom too, so the preview matches what 3D/BOM build.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', border: '1.5px solid #bdc3c7', borderRadius: 3, overflow: 'hidden', width: 34 }}>
      {zones.map((z, i) => (
        <div key={i} style={{
          height: z.h * scale,
          background: z.type === 'drawer' ? '#3498db22' : '#2ecc7122',
          borderTop: i > 0 ? '1px solid #bdc3c7' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 7, color: z.type === 'drawer' ? '#2980b9' : '#27ae60', fontWeight: 700, minHeight: 8
        }}>
          {z.type === 'drawer' ? 'D' : '🚪'}
        </div>
      ))}
    </div>
  )
}

export default function ZonePresetPicker({ height = 720, width = 600, selected, onChange }) {
  const { t } = useTranslation()
  const h = height >= 780 ? 800 : 720
  let presets = buildZonePresets(h)

  // Only show 2-door variant for wide enough cabinets (>= 700mm), hide it otherwise
  presets = presets.filter(p => p.doorCount !== 2 || width >= 700)

  return (
    <div>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>{t('zonePresetPicker.interiorLayout')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {presets.map(p => (
          <div key={p.id} onClick={() => onChange(p)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '4px 2px', borderRadius: 6, cursor: 'pointer',
              border: selected?.id === p.id ? '1.5px solid #3498db' : '1.5px solid #e0e0e0',
              background: selected?.id === p.id ? '#ebf5fb' : 'white',
            }}>
            <ZoneVisual zones={p.zones} />
            <div style={{ fontSize: 7, color: '#666', textAlign: 'center', lineHeight: 1.1 }}>{t(p.labelKey)}</div>
          </div>
        ))}
      </div>
      {selected && (
        <div style={{ marginTop: 6, fontSize: 9, color: '#666' }}>
          {t('zonePresetPicker.selected')} <strong>{t(selected.labelKey)}</strong>
          {' — '}{selected.zones.map(z => `${z.type === 'drawer' ? t('zonePresetPicker.drawer') : t('zonePresetPicker.door')} ${z.h}mm`).join(', ')}
          {selected.doorCount === 2 ? t('zonePresetPicker.twoDoors') : ''}
        </div>
      )}
    </div>
  )
}
