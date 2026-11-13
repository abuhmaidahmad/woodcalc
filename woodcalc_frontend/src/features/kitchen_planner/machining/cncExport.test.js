import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cncExport, cncZip, partsCsv } from './cncExport'
import { crc32, makeZip } from './zip'

const base = (id, extra = {}) => ({ id, label: 'Base 600', category: 'base', subtype: 'Single Door', width: 600, height: 720, depth: 560,
  doorStyle: 'Handle', shelfCount: 1, carcassMaterialCode: 'C18', frontMaterialCode: 'OAK', ...extra })
const wo = { order_number: 'WO125', sent_cabinet_ids: [] }
const room = (cabinets) => ({ room_number: 2, planner_data: { cabinets }, construction_settings: null })

const unzip = (bytes) => {
  const dir = mkdtempSync(join(tmpdir(), 'cnc-'))
  const file = join(dir, 'out.zip')
  writeFileSync(file, bytes)
  execFileSync('unzip', ['-tq', file]) // throws on a bad archive or CRC
  execFileSync('unzip', ['-q', file, '-d', join(dir, 'x')])
  return { dir: join(dir, 'x'), names: execFileSync('zipinfo', ['-1', file]).toString().trim().split('\n') }
}

describe('CNC export', () => {
  it('zips one DXF per piece, named by its ID, plus parts.csv', () => {
    const { pieces, errors, files } = cncExport(wo, room([base(1), base(2)]))
    expect(errors).toEqual([])
    const { dir, names } = unzip(cncZip(files))
    expect(names).toEqual([...pieces.map(p => `${p.id}.dxf`), 'parts.csv'])
    expect(names).toContain('WO125-R2-01-SL.dxf')
    const sl = readFileSync(join(dir, 'WO125-R2-01-SL.dxf'), 'utf8')
    expect(sl).toContain('WoodCalc part WO125-R2-01-SL 720 x 560 x 18')
    expect(sl).toContain('\n8\nHOLE_BOTTOM_D7_THRU\n')
    // A piece with nothing drilled still gets its outline.
    const bk = readFileSync(join(dir, 'WO125-R2-01-BK.dxf'), 'utf8')
    expect(bk).toContain('\n8\nOUTLINE\n')
  })

  it('lists every piece in parts.csv with its ID, cabinet, name, size, material and op count', () => {
    const { pieces } = cncExport(wo, room([base(1)]))
    const lines = partsCsv(pieces).replace(/^﻿/, '').trim().split('\r\n')
    expect(lines[0]).toBe('Part ID,Cabinet,Part name,L x W x T (mm),Material,Ops')
    expect(lines).toHaveLength(pieces.length + 1)
    const sl = pieces.find(p => p.code === 'SL')
    expect(lines).toContain(`WO125-R2-01-SL,Base 600,Side panel,720 x 560 x 18,C18,${sl.part.machining_ops.length}`)
    expect(lines.find(l => l.startsWith('WO125-R2-01-D1,'))).toMatch(/,OAK,2$/) // two hinge cups
    expect(partsCsv([{ ...sl, cabinet: 'Base, "tall"' }])).toContain('"Base, ""tall"""')
  })

  it('names every file in plain ASCII, even for Arabic order numbers and labels', () => {
    const arWo = { order_number: 'أمر-١٢٥', sent_cabinet_ids: [] }
    const { pieces, files } = cncExport(arWo, room([base(1, { label: 'خزانة سفلية' })]))
    const names = files.map(f => f.name)
    names.forEach(n => expect(n).toMatch(/^[A-Za-z0-9-]+\.(dxf|csv)$/))
    expect(names).toContain('125-R2-01-SL.dxf')
    expect(names).toContain('parts.csv')
    // The Arabic text stays inside parts.csv as data.
    const csv = files.find(f => f.name === 'parts.csv').data
    expect(csv).toContain('125-R2-01-SL,خزانة سفلية,Side panel,')
    expect(pieces.every(p => /^[\x21-\x7E]+$/.test(p.id))).toBe(true)
  })

  it('reports buildMachining errors per piece before anything is exported', () => {
    // A shelf planned 10mm off the bottom puts its lowest pins off the sides.
    const { errors } = cncExport(wo, room([base(1, { shelfHeights: [10] })]))
    expect(errors.length).toBeGreaterThan(0)
    expect(new Set(errors.map(e => e.id))).toEqual(new Set(['WO125-R2-01-SL', 'WO125-R2-01-SR']))
    expect(errors[0].message).toMatch(/off the part/)
  })
})

describe('CNC export of metal-sided drawers', () => {
  it('lists a missing drawer back size as a problem before export', () => {
    const cab = base(1, { subtype: 'Drawers', drawerSystem: 'LEGRABOX', drawerBoxConstruction: 'metal_sided',
      zonePreset: { zones: [{ type: 'drawer', h: 360 }, { type: 'drawer', h: 360 }] } })
    const { errors } = cncExport(wo, room([cab]), { drawerSystems: [{ name: 'LEGRABOX', box_construction: 'metal_sided' }] })
    expect(errors.map(e => e.id)).toEqual(['WO125-R2-01-DB1-BT', 'WO125-R2-01-DB2-BT'])
    expect(errors[0].message).toMatch(/set the back sizes for LEGRABOX/)
  })
})

describe('zip writer', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926')
  })
  it('writes an archive unzip accepts, UTF-8 names included', () => {
    // Names are read from the central directory here: macOS's bundled unzip and
    // zipinfo mangle UTF-8 names, so they can only check the archive itself.
    const bytes = makeZip([{ name: 'a.txt', data: 'hello' }, { name: 'جانب.txt', data: new Uint8Array([1, 2, 3]) }])
    const file = join(mkdtempSync(join(tmpdir(), 'cnc-')), 'out.zip')
    writeFileSync(file, bytes)
    execFileSync('unzip', ['-tq', file]) // throws on a bad archive or CRC
    expect(execFileSync('unzip', ['-p', file, 'a.txt']).toString()).toBe('hello')
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const entries = []
    for (let i = 0; i + 46 <= bytes.length; i++) {
      if (view.getUint32(i, true) !== 0x02014b50) continue
      const len = view.getUint16(i + 28, true)
      entries.push({ utf8: (view.getUint16(i + 8, true) & 0x800) !== 0, name: new TextDecoder().decode(bytes.subarray(i + 46, i + 46 + len)) })
    }
    expect(entries).toEqual([{ utf8: true, name: 'a.txt' }, { utf8: true, name: 'جانب.txt' }])
  })
})
