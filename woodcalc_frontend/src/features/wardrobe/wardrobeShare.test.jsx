import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { LanguageProvider } from '../../i18n/LanguageContext'
import { DEFAULT_WARDROBE_STANDARD as STD } from './wardrobeStandard'
import { computeDesign, defaultCloset } from './closetEngine'
import { defaultDesign } from './wardrobeEngine'
import { priceWardrobe } from './wardrobePricing'
import { buildWardrobePlannerData, savedWardrobe, DEFAULT_FRONT_COLOR } from './wardrobeRoom'
import WardrobeShareView from './WardrobeShareView'
import KitchenShareView from '../../pages/KitchenShareView'
import { SharedRoom } from '../../pages/ShareView'
import { shareKind } from '../rooms/shareKind'

const planner = (design, frontColor) => {
  const result = computeDesign(design, STD)
  return buildWardrobePlannerData({ design, std: STD, price: priceWardrobe(result, STD), result, picked: {}, frontColor })
}
const shared = (design, extra = {}) => ({ name: 'Master bedroom', room_type: 'wardrobe', kind: 'wardrobe', company_name: 'Abu Hmaid Woodworks', company_slug: 'ahw', design, standard: STD, frontColor: '#6e4b33', ...extra })
const html = (data) => renderToString(<LanguageProvider><WardrobeShareView data={data} /></LanguageProvider>).replace(/<!-- -->/g, '')

describe('front colour in saved wardrobe rooms', () => {
  it('saves the chosen front colour', () => {
    expect(planner(defaultDesign(STD), '#6e4b33').frontColor).toBe('#6e4b33')
    expect(planner(defaultDesign(STD)).frontColor).toBe(DEFAULT_FRONT_COLOR)
  })

  it('falls back to the default colour for rooms saved before', () => {
    const data = JSON.parse(JSON.stringify(planner(defaultDesign(STD), '#6e4b33')))
    expect(savedWardrobe({ planner_data: data }).frontColor).toBe('#6e4b33')
    delete data.frontColor
    expect(savedWardrobe({ planner_data: data }).frontColor).toBe(DEFAULT_FRONT_COLOR)
    expect(savedWardrobe({ planner_data: { ...data, frontColor: 'red;}' } }).frontColor).toBe(DEFAULT_FRONT_COLOR)
  })
})

describe('share page', () => {
  it('shows the wardrobe view for wardrobe rooms and the kitchen view otherwise', () => {
    expect(shareKind(shared(defaultDesign(STD)))).toBe('wardrobe')
    expect(shareKind({ name: 'Kitchen', cabinets: [] })).toBe('kitchen')
    expect(shareKind({ kind: 'wardrobe' })).toBe('kitchen')
    expect(SharedRoom({ data: shared(defaultDesign(STD)) }).type).toBe(WardrobeShareView)
    expect(SharedRoom({ data: { name: 'Kitchen', cabinets: [] } }).type).toBe(KitchenShareView)
  })

  it('renders a wardrobe with the company, room and size and nothing commercial', () => {
    const out = html(shared(defaultDesign(STD)))
    expect(out).toContain('Abu Hmaid Woodworks')
    expect(out).toContain('Master bedroom')
    expect(out).toContain('2400 × 2600 mm')
    expect(out).toContain('Doors open')
    expect(out).not.toContain('Plan')
    ;['JD', 'Cut list', 'Separate boxes', 'Shared partitions', 'Construction standard', 'Price', 'Save'].forEach((w) => expect(out).not.toContain(w))
  })

  it('renders a closet with room depth and a plan tab', () => {
    const closet = { ...defaultCloset(STD), island: { ...defaultCloset(STD).island, enabled: true } }
    const out = html(shared({ ...defaultDesign(STD), mode: 'closet', closet }))
    expect(out).toContain('3000 × 2600 × 2400 mm')
    expect(out).toContain('Walk-in closet')
    expect(out).toContain('Plan')
    ;['JD', 'Cut list', 'Separate boxes', 'Shared partitions', 'Price'].forEach((w) => expect(out).not.toContain(w))
  })

  it('works without a saved standard', () => {
    expect(html(shared(defaultDesign(STD), { standard: null }))).toContain('Master bedroom')
  })
})
