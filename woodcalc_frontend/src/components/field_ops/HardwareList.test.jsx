import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LanguageProvider } from '../../i18n/LanguageContext'
import HardwareList from './HardwareList'

const render = (items) => renderToStaticMarkup(<LanguageProvider><HardwareList items={items} /></LanguageProvider>)

describe('HardwareList', () => {
  it('shows hardware names and quantities but no cost values', () => {
    const html = render([
      { key: 'hinges', qty: 4, cost: 123, price: 456, total: 789 },
      { key: 'unit_cost', qty: 321 },
      { key: 'drawer_runner_sets', qty: 2, spec: 'LEGRABOX', margin: 654 },
    ])
    expect(html).toContain('Hinges')
    expect(html).toContain('>4<')
    expect(html).toContain('LEGRABOX')
    for (const hidden of ['123', '456', '789', '321', '654', 'cost', 'price', 'margin', 'total']) {
      expect(html).not.toContain(hidden)
    }
    expect(html.match(/data-hardware-key=/g)).toHaveLength(2)
  })

  it('shows the empty message when nothing is left', () => {
    expect(render([{ key: 'price', qty: 5 }])).toContain('No hardware')
  })
})
