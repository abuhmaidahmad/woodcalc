import React, { useEffect, useState } from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import { loadDrawerSystems } from '../../api/drawerSystems'
import { drawerSystemSnapshot } from './wardrobeEngine'
import { label, input } from './ui'

export default function DrawerSystemPicker({ value, onChange, std }) {
  const { t } = useTranslation()
  const [systems, setSystems] = useState([])
  useEffect(() => {
    let alive = true
    loadDrawerSystems().then((list) => {
      if (alive) setSystems(list.filter((s) => s.box_construction === 'wood_box' && s.is_active !== false))
    })
    return () => { alive = false }
  }, [])
  const known = value && !systems.some((s) => s.id === value.id)
  return (
    <label style={{ display: 'block' }}>
      <span style={label}>{t('wardrobe.drawerSystem')}</span>
      <select style={input} value={value?.id ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : drawerSystemSnapshot(systems.find((s) => String(s.id) === e.target.value)) || value)}>
        <option value="">{t('wardrobe.drawerSystemNone', { c: std.runnerClearance })}</option>
        {known && <option value={value.id}>{t('wardrobe.drawerSystemOption', { name: value.name, c: value.runnerSideClearance })}</option>}
        {systems.map((s) => (
          <option key={s.id} value={s.id}>{t('wardrobe.drawerSystemOption', { name: s.name, c: Number(s.runner_side_clearance ?? 12.5) })}</option>
        ))}
      </select>
    </label>
  )
}
