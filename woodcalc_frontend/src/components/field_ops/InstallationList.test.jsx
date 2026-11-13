import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LanguageProvider } from '../../i18n/LanguageContext'
import InstallationList from './InstallationList'

const job = (id, extra) => ({ id, status: 'scheduled', customer_name: 'C', project_name: 'P', room_name: 'K', revision_number: 1, assignments: [], ...extra })
const render = (installations) => renderToStaticMarkup(
  <LanguageProvider><InstallationList installations={installations} rooms={[]} crew={[]} onChanged={() => {}} /></LanguageProvider>,
)

describe('InstallationList not-frozen badge', () => {
  it('shows the badge only on jobs without saved hardware totals', () => {
    const html = render([job(1, { hardware_frozen: false }), job(2, { hardware_frozen: true }), job(3, {})])
    expect(html.match(/data-badge="not-frozen"/g)).toHaveLength(1)
    expect(html).toContain('Hardware not frozen')
  })
})
