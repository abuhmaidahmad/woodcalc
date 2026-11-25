import React, { useCallback } from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import MaterialLibrary from '../kitchen_planner/MaterialLibrary'
import { materialSkus, withMaterials } from './wardrobeMaterials'
import { card, ghost } from './ui'

export default function WardrobeMaterialsCard({ design, setDesign, readOnly }) {
  const { t } = useTranslation()
  const skus = materialSkus(design) || { carcass: design.pricing?.picks?.Carcass || null, front: design.pricing?.picks?.Front || null }
  const match = !!design.materials?.frontMatchesCarcass
  const set = useCallback((patch) => { if (!readOnly) setDesign((d) => withMaterials(d, patch)) }, [readOnly, setDesign])
  const onCarcass = useCallback((m) => set({ carcass: m.code }), [set])
  const onFront = useCallback((m) => set({ front: m.code }), [set])
  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{t('wardrobe.finish.title')}</div>
      <MaterialLibrary target="carcass" libraryOnly selectedCode={skus.carcass} onSelect={onCarcass} />
      {skus.carcass && <button style={{ ...ghost, marginTop: 6 }} onClick={() => set({ carcass: null })}>{t('wardrobe.finish.clear')}</button>}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, margin: '12px 0' }}>
        <input type="checkbox" checked={match} onChange={(e) => set({ frontMatchesCarcass: e.target.checked })} />
        {t('wardrobe.finish.matchCarcass')}
      </label>
      {!match && (
        <>
          <MaterialLibrary target="front" libraryOnly selectedCode={skus.front} onSelect={onFront} />
          {skus.front && <button style={{ ...ghost, marginTop: 6 }} onClick={() => set({ front: null })}>{t('wardrobe.finish.clear')}</button>}
        </>
      )}
    </div>
  )
}
