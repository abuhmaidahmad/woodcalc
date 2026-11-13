import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { LanguageProvider } from '../../i18n/LanguageContext'
import PieceCutList from './PieceCutList'
import { workOrderPieces } from '../kitchen_planner/machining/pieces'

const base = (id) => ({ id, label: 'Base 600', category: 'base', subtype: 'Single Door', width: 600, height: 720, depth: 560,
  doorStyle: 'Handle', carcassMaterialCode: 'C18', frontMaterialCode: 'OAK' })

describe('PieceCutList', () => {
  it('shows one row per name + size + material with its quantity, IDs folded away', () => {
    const pieces = workOrderPieces({ order_number: 'WO125' }, { room_number: 2, planner_data: { cabinets: [base(1), base(2)] } })
    const html = renderToString(<LanguageProvider><PieceCutList pieces={pieces} /></LanguageProvider>).replace(/<!-- -->/g, '')
    const rows = html.match(/data-group=/g)
    // sides, bottom, front rail, back rail, back, standard shelf, door: one row
    // each for two identical cabinets
    expect(rows).toHaveLength(7)
    expect(html).toMatch(/Side panel[^<]*<\/td><td[^>]*>720 × 560 × 18<\/td><td[^>]*>C18<\/td><td[^>]*>4<\/td>/)
    expect(html).not.toContain('data-piece-id')
  })
})
