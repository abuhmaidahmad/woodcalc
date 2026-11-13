import { describe, it, expect } from 'vitest'
import { confirmPreviewText } from './confirmPreview'
import en from '../../i18n/en.json'

const t = (key) => key.split('.').reduce((o, k) => o?.[k], en) ?? key

describe('confirm dialog text', () => {
  it('shows no dialog when nothing is missing and nothing changed', () => {
    expect(confirmPreviewText({ warnings: [], changes: [] }, t)).toBeNull()
    expect(confirmPreviewText(undefined, t)).toBeNull()
  })

  it('lists drawer systems with no sizes in the catalog', () => {
    const text = confirmPreviewText({ warnings: [{ system: 'Gone', missing: ['bottom', 'back'] }, { system: 'LEGRABOX', missing: ['back'] }], changes: [] }, t)
    expect(text.split('\n')).toEqual([
      'These drawer systems have no sizes in the Materials Catalog:',
      '• Gone: bottom (default size used), back (no back will be cut)',
      '• LEGRABOX: back (no back will be cut)',
      'Add them in the Materials Catalog first, or confirm now with the defaults.',
      '',
      'Confirm anyway?',
    ])
  })

  it('lists what re-confirming changes', () => {
    const text = confirmPreviewText({ warnings: [], changes: [
      { setting: 'back_construction', system: null, field: null, old: 'surface', new: 'groove' },
      { setting: 'drawer_box_material_sku', system: null, field: null, old: null, new: 'WB16' },
      { setting: 'drawer_systems', system: 'LEGRABOX', field: 'bottom_thickness', old: 8, new: 12 },
      { setting: 'drawer_systems', system: 'TANDEMBOX', field: null, old: null, new: {}, change: 'added' },
      { setting: 'drawer_systems', system: 'Old', field: null, old: {}, new: null, change: 'removed' },
    ] }, t)
    expect(text.split('\n')).toEqual([
      'Confirming again saves the current settings. Changes since this room was last confirmed:',
      '• Back panel fixing: surface → groove',
      '• Drawer box board: — → WB16',
      '• LEGRABOX — bottom thickness: 8 → 12',
      '• TANDEMBOX: drawer system added (catalog sizes)',
      '• Old: no longer used',
      '',
      'Confirm anyway?',
    ])
  })

  it('has every label it can need in both languages', async () => {
    const ar = (await import('../../i18n/ar.json')).default
    const keys = Object.keys(en.confirmPreview)
    expect(Object.keys(ar.confirmPreview).sort()).toEqual([...keys].sort())
    const settings = ['back_construction', 'back_panel_thickness_mm', 'back_panel_material_sku', 'drawer_box_material_sku',
      'drawer_box_thickness_mm', 'drawer_bottom_material_sku', 'drawer_bottom_thickness_mm']
    const fields = ['bottom_width_deduction', 'bottom_depth_deduction', 'bottom_thickness', 'back_width_deduction', 'back_height_m', 'back_height_c', 'back_thickness']
    const changes = ['added', 'removed', 'catalog_added', 'catalog_removed']
    ;[...settings.map(s => `setting_${s}`), ...fields.map(f => `field_${f}`), ...changes.map(c => `system_${c}`)]
      .forEach(k => expect(keys).toContain(k))
  })
})
