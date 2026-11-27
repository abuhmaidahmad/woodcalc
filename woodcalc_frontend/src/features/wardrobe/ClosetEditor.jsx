import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import ErrorBoundary from '../../components/ErrorBoundary'
import { DOOR_TYPES, CONSTRUCTION_TYPES, BACK_TYPES, DRAWER_STYLES, withSectionCount, autoSectionCount } from './wardrobeEngine'
import { runSectionCount } from './closetEngine'
import WardrobeElevation from './WardrobeElevation'
import SectionEditor from './SectionEditor'
import ChecksCard from './ChecksCard'
import CutListPanel from './CutListPanel'
import NumField from './NumField'
import DrawerSystemPicker from './DrawerSystemPicker'
import { ACCENT, DARK, FIELDSET, card, label, input, ghost } from './ui'
import ClosetRoomStep from './ClosetRoomStep'
import UnitShape from './UnitShape'
import RoomCanvas from '../kitchen_planner/RoomCanvas'
import { PLANNER_SCALE, DEFAULT_WALL_THICKNESS } from '../kitchen_planner/wallGeometry'
import { closetRoom } from './closetRoom'
import { wallPolygons } from './closetChecks'
import { unitSize, unitHeight, normRotation } from './unitGeometry'
import { nextLabel, wallInfo, freeSpan, placeOnWall, wallDistances, moveAlongWall, addWardrobeOnWall, addFreeUnit, resizeUnit, stopAtFace } from './unitOps'
import { unitName } from './wardrobeRoom'
import AccessoriesCard from './AccessoriesCard'
import SlidingDoorsCard from './SlidingDoorsCard'
import { DESK_SIDES } from './deskEngine'

const Closet3D = lazy(() => import('./Closet3D'))
const ROTATIONS = [0, 90, 180, 270]

function Seg({ options, value, onChange, labelOf }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} style={{ ...ghost, flex: 1, background: value === o ? DARK : '#fff', color: value === o ? '#fff' : DARK }}>{labelOf(o)}</button>
      ))}
    </div>
  )
}

const toCab = (u) => ({ ...u, width: unitSize(u).length, depth: unitSize(u).depth, height: unitHeight(u) })

export default function ClosetEditor({ design, setDesign, result, std, readOnly, look, constructionLabel, materialsCard, materialNames }) {
  const { t } = useTranslation()
  const closet = design.closet
  const room = closetRoom(closet)
  const units = useMemo(() => closet.units || [], [closet.units])
  const [step, setStep] = useState('closet')
  const [view, setView] = useState('plan')
  const [doorMode, setDoorMode] = useState('closed')
  const [showWalls, setShowWalls] = useState(true)
  const [selId, setSelId] = useState(() => units[0]?.id || null)
  const [section, setSection] = useState({ section: 0, zone: null })
  const [canvasSel, setCanvasSel] = useState(null)
  const [canvasType, setCanvasType] = useState(null)
  const [wallThickness, setWallThickness] = useState(DEFAULT_WALL_THICKNESS)

  useEffect(() => {
    if (canvasType === 'cabinet' && canvasSel) {
      setSelId(canvasSel)
      setSection({ section: 0, zone: null })
    }
  }, [canvasType, canvasSel])

  const name = (u) => unitName(u, t)
  const setCloset = useCallback((fn) => setDesign((d) => ({ ...d, closet: fn(d.closet) })), [setDesign])
  const unit = units.find((u) => u.id === selId) || null
  const out = result.units?.find((u) => u.id === selId) || null
  const setUnit = (fn) => setCloset((c) => ({ ...c, units: c.units.map((u) => (u.id === selId ? fn(u) : u)) }))
  const setUnitDesign = (patch) => setUnit((u) => resizeUnit(u, patch, std))
  const pick = (id) => { setSelId(id); setCanvasSel(id); setCanvasType('cabinet'); setSection({ section: 0, zone: null }) }

  const cabs = useMemo(() => units.map(toCab), [units])
  const setCabs = useCallback((upd) => setCloset((c) => {
    const cur = (c.units || []).map(toCab)
    const next = typeof upd === 'function' ? upd(cur) : upd
    const list = []
    next.forEach((cab) => {
      const u = { ...cab }
      ;['width', 'depth', 'height'].forEach((k) => { delete u[k] })
      const clash = list.some((o) => o.label === u.label)
      list.push({ ...u, label: clash ? nextLabel(list.concat(next)) : u.label, rotation: normRotation(u.rotation) })
    })
    return { ...c, units: list }
  }), [setCloset])
  const setRoomPart = (key) => (u) => setCloset((c) => {
    const r = closetRoom(c)
    return { ...c, room: { ...r, [key]: typeof u === 'function' ? u(r[key]) : u } }
  })

  const renderCabinet = useCallback(({ cab, scale, isSelected, isColliding, onMouseDown }) => {
    const u = result.units?.find((x) => x.id === cab.id)
    if (!u) return null
    const w = cab.width * scale
    const h = cab.depth * scale
    const rot = cab.rotation || 0
    return (
      <g transform={`translate(${cab.x * scale},${cab.y * scale}) rotate(${rot}, ${w / 2}, ${h / 2})`}
        onMouseDown={(e) => onMouseDown(e, cab.id)} style={{ cursor: 'move' }}>
        <UnitShape unit={u} s={scale} selected={isSelected} colliding={isColliding} name={unitName(u, t)} rotation={rot} />
      </g>
    )
  }, [result.units, t])

  const walls = wallPolygons(room)
  const wallLen = (i) => Math.round(Math.hypot(walls[i].face[1][0] - walls[i].face[0][0], walls[i].face[1][1] - walls[i].face[0][1]))
  const info = unit ? (unit.wallIndex != null ? wallInfo(room, unit.wallIndex) : null) : null
  const dist = info && unit ? wallDistances(info, unit) : null

  const addUnit = (next) => {
    if (next === closet) return
    setCloset(() => next)
    pick(next.units[next.units.length - 1].id)
  }
  const addOnWall = (i) => addUnit(addWardrobeOnWall({ ...closet, units }, room, i, std))
  const addFree = (kind) => addUnit(addFreeUnit({ ...closet, units }, room, kind, std))
  const removeUnit = () => {
    setCloset((c) => ({ ...c, units: c.units.filter((u) => u.id !== selId) }))
    setSelId(null)
  }
  const putOnWall = (i) => setUnit((u) => {
    const w = wallInfo(closetRoom(closet), i)
    if (!w) return u
    const [s] = freeSpan(w, units, u.id)
    return { ...u, wallIndex: i, ...placeOnWall(w, s, unitSize(u).length, unitSize(u).depth) }
  })
  const rotate = (r) => setUnit((u) => ({ ...u, rotation: r, wallIndex: null }))
  const setCount = (n) => setUnit((u) => ({ ...u, design: withSectionCount(u.design, n, std) }))
  const autoCount = () => setUnit((u) => ({ ...u, design: withSectionCount(u.design, Math.max(autoSectionCount(u.design, std), runSectionCount(u.design.width, std)), std) }))
  const fix = (w) => {
    if (w.fix?.type !== 'corner') return null
    const byLabel = (id) => units.find((u) => u.id === id)
    const a = byLabel(w.fix.a)
    const b = byLabel(w.fix.b)
    if (!a || !b) return null
    return [
      { label: t('wardrobe.closet.fix.runsInto', { unit: name(a) }), run: () => setCloset((c) => stopAtFace(c, a.id, b.id, std)) },
      { label: t('wardrobe.closet.fix.runsInto', { unit: name(b) }), run: () => setCloset((c) => stopAtFace(c, b.id, a.id, std)) },
    ]
  }

  const sheets = result.materials.reduce((a, m) => a + m.sheets, 0)
  const stepBar = (
    <div className="wb-noprint" style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
      {['room', 'closet'].map((k) => (
        <button key={k} onClick={() => setStep(k)} style={{ ...ghost, padding: '7px 14px', fontWeight: 700, borderColor: step === k ? ACCENT : '#ddd6cc', color: step === k ? ACCENT : DARK }}>
          {t(`wardrobe.closet.step.${k}`)}
        </button>
      ))}
    </div>
  )

  if (step === 'room') {
    return (
      <>
        {stepBar}
        <ClosetRoomStep closet={closet} setCloset={setCloset} readOnly={readOnly} />
      </>
    )
  }

  const d = unit?.design
  return (
    <>
      {stepBar}
      <div className="wb-grid">
        <fieldset className="wb-noprint" disabled={readOnly} style={FIELDSET}>
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{t('wardrobe.closet.unitsTitle')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {units.map((u) => (
                <button key={u.id} onClick={() => pick(u.id)}
                  style={{ ...ghost, padding: '4px 8px', background: selId === u.id ? ACCENT : '#fff', color: selId === u.id ? '#fff' : DARK, borderColor: selId === u.id ? ACCENT : '#ddd6cc' }}>{name(u)}</button>
              ))}
              {!units.length && <div style={{ fontSize: 12, color: '#999' }}>{t('wardrobe.closet.noUnits')}</div>}
            </div>
            <select style={input} value="" onChange={(e) => e.target.value !== '' && addOnWall(Number(e.target.value))}>
              <option value="">{t('wardrobe.closet.addOnWall')}</option>
              {walls.map((w) => <option key={w.index} value={w.index}>{t('wardrobe.closet.wallOption', { n: w.index + 1, len: wallLen(w.index) })}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button style={{ ...ghost, flex: 1 }} onClick={() => addFree('wardrobe')}>{t('wardrobe.closet.addFree')}</button>
              <button style={{ ...ghost, flex: 1 }} onClick={() => addFree('island')}>{t('wardrobe.closet.addIsland')}</button>
              <button style={{ ...ghost, flex: 1 }} onClick={() => addFree('desk')}>{t('wardrobe.closet.addDesk')}</button>
            </div>
            <div style={{ marginTop: 10 }}>
              <NumField title={t('wardrobe.closet.newHeight')} value={closet.height} onChange={(v) => setCloset((c) => ({ ...c, height: v ?? 0 }))} />
            </div>
          </div>

          {unit && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{t('wardrobe.closet.placementTitle', { unit: name(unit) })}</div>
                <button style={{ ...ghost, color: '#9b2c2c' }} onClick={removeUnit}>{t('wardrobe.closet.deleteUnit')}</button>
              </div>
              <span style={label}>{t('wardrobe.closet.rotation')}</span>
              <Seg options={ROTATIONS} value={normRotation(unit.rotation)} onChange={rotate} labelOf={(o) => `${o}°`} />
              {dist ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                  <NumField title={t('wardrobe.closet.fromWallStart')} value={dist.start} onChange={(v) => setUnit((u) => moveAlongWall(u, info, v ?? 0))} />
                  <NumField title={t('wardrobe.closet.fromWallEnd')} value={dist.end} onChange={(v) => setUnit((u) => moveAlongWall(u, info, info.length - (v ?? 0) - unitSize(u).length))} />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                  <NumField title={t('wardrobe.closet.posX')} value={Math.round(unit.x)} min={-100000} onChange={(v) => setUnit((u) => ({ ...u, x: v ?? 0, wallIndex: null }))} />
                  <NumField title={t('wardrobe.closet.posY')} value={Math.round(unit.y)} min={-100000} onChange={(v) => setUnit((u) => ({ ...u, y: v ?? 0, wallIndex: null }))} />
                </div>
              )}
              <select style={{ ...input, marginTop: 10 }} value="" onChange={(e) => e.target.value !== '' && putOnWall(Number(e.target.value))}>
                <option value="">{t('wardrobe.closet.placeOnWall')}</option>
                {walls.map((w) => <option key={w.index} value={w.index}>{t('wardrobe.closet.wallOption', { n: w.index + 1, len: wallLen(w.index) })}</option>)}
              </select>
            </div>
          )}

          {unit?.kind === 'wardrobe' && (
            <div style={card}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <NumField title={t('wardrobe.width')} value={d.width} onChange={(v) => setUnitDesign({ width: v ?? 0 })} />
                <NumField title={t('wardrobe.height')} value={d.height} onChange={(v) => setUnitDesign({ height: v ?? 0 })} />
                <NumField title={t('wardrobe.depth')} value={d.depth} onChange={(v) => setUnitDesign({ depth: v ?? 0 })} />
                <NumField title={t('wardrobe.fillerLeft')} value={d.fillerLeft} onChange={(v) => setUnitDesign({ fillerLeft: v ?? 0 })} />
                <NumField title={t('wardrobe.fillerRight')} value={d.fillerRight} onChange={(v) => setUnitDesign({ fillerRight: v ?? 0 })} />
                <NumField title={t('wardrobe.topFiller')} value={d.topFiller} onChange={(v) => setUnitDesign({ topFiller: v ?? 0 })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10, alignItems: 'end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, paddingBottom: 8 }}>
                  <input type="checkbox" checked={!!d.loft} onChange={(e) => setUnitDesign({ loft: e.target.checked })} />
                  {t('wardrobe.loft')}
                </label>
                <NumField title={t('wardrobe.loftH')} value={d.loftH} disabled={!d.loft} onChange={(v) => setUnitDesign({ loftH: v ?? 0 })} />
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={label}>{t('wardrobe.doorType')}</span>
                <Seg options={DOOR_TYPES} value={d.doorType || 'none'} onChange={(v) => setUnitDesign({ doorType: v })} labelOf={(o) => t(`wardrobe.doorTypes.${o}`)} />
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={label}>{t('wardrobe.construction')}</span>
                <Seg options={CONSTRUCTION_TYPES} value={d.construction || 'boxes'} onChange={(v) => setUnitDesign({ construction: v })} labelOf={(o) => t(`wardrobe.constructionTypes.${o}`)} />
                {d.construction === 'shared' && (
                  <select style={{ ...input, marginTop: 8 }} value={d.backType || 'none'} onChange={(e) => setUnitDesign({ backType: e.target.value })}>
                    {BACK_TYPES.map((bt) => <option key={bt} value={bt}>{t(`wardrobe.backTypes.${bt}`)}</option>)}
                  </select>
                )}
              </div>
              <div style={{ marginTop: 10 }}>
                <DrawerSystemPicker value={d.drawerSystem} onChange={(v) => setUnitDesign({ drawerSystem: v })} std={std} />
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={label}>{t('wardrobe.sections')}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button style={ghost} onClick={() => setCount(d.sections.length - 1)}>−</button>
                  <div style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{d.sections.length}</div>
                  <button style={ghost} onClick={() => setCount(d.sections.length + 1)}>+</button>
                  <button style={ghost} onClick={autoCount}>{t('wardrobe.autoSections')}</button>
                </div>
              </div>
            </div>
          )}

          {unit?.kind === 'wardrobe' && d.doorType === 'sliding' && out && (
            <SlidingDoorsCard design={d} result={out.result} onChange={(slidingDoors) => setUnitDesign({ slidingDoors })} />
          )}

          {unit?.kind === 'wardrobe' && (
            <AccessoriesCard accessories={d.accessories} onChange={(accessories) => setUnitDesign({ accessories })} />
          )}

          {unit?.kind === 'desk' && (
            <div style={card}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <NumField title={t('wardrobe.width')} value={d.width} onChange={(v) => setUnitDesign({ width: v ?? 0 })} />
                <NumField title={t('wardrobe.depth')} value={d.depth} onChange={(v) => setUnitDesign({ depth: v ?? 0 })} />
                <NumField title={t('wardrobe.height')} value={d.height} onChange={(v) => setUnitDesign({ height: v ?? 0 })} />
                <NumField title={t('wardrobe.desk.drawers')} value={d.drawers} min={0} onChange={(v) => setUnitDesign({ drawers: v ?? 0 })} />
                <NumField title={t('wardrobe.desk.drawerW')} value={d.drawerW} onChange={(v) => setUnitDesign({ drawerW: v ?? 0 })} />
                <div style={{ fontSize: 11, color: '#777', paddingTop: 18 }}>{t('wardrobe.desk.knee', { w: Math.round(out?.knee ?? 0) })}</div>
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={label}>{t('wardrobe.desk.drawerSide')}</span>
                <Seg options={DESK_SIDES} value={d.drawerSide || 'right'} onChange={(v) => setUnitDesign({ drawerSide: v })} labelOf={(o) => t(`wardrobe.desk.sides.${o}`)} />
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input type="checkbox" checked={!!d.endLeft} onChange={(e) => setUnitDesign({ endLeft: e.target.checked })} />{t('wardrobe.desk.endLeft')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input type="checkbox" checked={!!d.endRight} onChange={(e) => setUnitDesign({ endRight: e.target.checked })} />{t('wardrobe.desk.endRight')}
                </label>
              </div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{t('wardrobe.desk.endHint')}</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 10 }}>
                <input type="checkbox" checked={!!d.mirror?.enabled} onChange={(e) => setUnitDesign({ mirror: { ...d.mirror, enabled: e.target.checked } })} />{t('wardrobe.desk.mirror')}
              </label>
              {d.mirror?.enabled && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                  <NumField title={t('wardrobe.acc.mirrorW')} value={d.mirror.w} onChange={(v) => setUnitDesign({ mirror: { ...d.mirror, w: v ?? 0 } })} />
                  <NumField title={t('wardrobe.acc.mirrorH')} value={d.mirror.h} onChange={(v) => setUnitDesign({ mirror: { ...d.mirror, h: v ?? 0 } })} />
                  <NumField title={t('wardrobe.desk.mirrorFrom')} value={d.mirror.elevation} onChange={(v) => setUnitDesign({ mirror: { ...d.mirror, elevation: v ?? 0 } })} />
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                <DrawerSystemPicker value={d.drawerSystem} onChange={(v) => setUnitDesign({ drawerSystem: v })} std={std} />
              </div>
            </div>
          )}

          {unit?.kind === 'wardrobe' && out && (
            <SectionEditor design={out.design} setDesign={(fn) => setUnit((u) => ({ ...u, design: fn(u.design) }))} result={out.result} std={std}
              selected={section} setSelected={setSection} title={name(unit)} />
          )}

          {unit?.kind === 'island' && (
            <div style={card}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <NumField title={t('wardrobe.width')} value={d.width} onChange={(v) => setUnitDesign({ width: v ?? 0 })} />
                <NumField title={t('wardrobe.depth')} value={d.depth} onChange={(v) => setUnitDesign({ depth: v ?? 0 })} />
                <NumField title={t('wardrobe.height')} value={d.height} onChange={(v) => setUnitDesign({ height: v ?? 0 })} />
                <NumField title={t('wardrobe.closet.bays')} value={d.bays} min={1} onChange={(v) => setUnitDesign({ bays: v || 1 })} />
                <NumField title={t('wardrobe.closet.drawersPerBay')} value={d.drawers} min={1} onChange={(v) => setUnitDesign({ drawers: v || 1 })} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, paddingTop: 18 }}>
                  <input type="checkbox" checked={!!d.doubleSided} onChange={(e) => setUnitDesign({ doubleSided: e.target.checked })} />
                  {t('wardrobe.closet.doubleSided')}
                </label>
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={label}>{t('wardrobe.construction')}</span>
                <Seg options={CONSTRUCTION_TYPES} value={d.construction} onChange={(v) => setUnitDesign({ construction: v })} labelOf={(o) => t(`wardrobe.constructionTypes.${o}`)} />
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={label}>{t('wardrobe.closet.drawerStyle')}</span>
                <Seg options={DRAWER_STYLES} value={d.drawerStyle === 'internal' ? 'internal' : 'external'} onChange={(v) => setUnitDesign({ drawerStyle: v })} labelOf={(o) => t(`wardrobe.closet.drawerStyles.${o}`)} />
              </div>
              <div style={{ marginTop: 10 }}>
                <DrawerSystemPicker value={d.drawerSystem} onChange={(v) => setUnitDesign({ drawerSystem: v })} std={std} />
              </div>
            </div>
          )}

          {materialsCard}
          <ChecksCard warnings={result.warnings} runLabel={(r) => (['A', 'B', 'C', 'I'].includes(r) ? t(`wardrobe.closet.wall.${r}`) : r)} fixesFor={readOnly ? null : fix} />
        </fieldset>

        <div className="wb-print-full" style={{ minWidth: 0 }}>
          <div style={{ ...card, padding: 12 }} className="wb-noprint">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {['plan', 'front', '3d'].map((v) => (
                  <button key={v} onClick={() => setView(v)} style={{ ...ghost, background: view === v ? DARK : '#fff', color: view === v ? '#fff' : DARK }}>
                    {v === 'front' && unit ? `${t('wardrobe.view.front')} · ${name(unit)}` : t(`wardrobe.closet.view.${v}`)}
                  </button>
                ))}
              </div>
              {view === '3d' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {['closed', 'open', 'hidden'].map((m) => (
                    <button key={m} onClick={() => setDoorMode(m)} style={{ ...ghost, borderColor: doorMode === m ? ACCENT : '#ddd6cc', color: doorMode === m ? ACCENT : DARK }}>{t(`wardrobe.doorMode.${m}`)}</button>
                  ))}
                  <button onClick={() => setShowWalls((v) => !v)} style={{ ...ghost, borderColor: showWalls ? ACCENT : '#ddd6cc', color: showWalls ? ACCENT : DARK }}>{t('wardrobe.closet.walls')}</button>
                </div>
              )}
            </div>
            {view === 'plan' && (
              <div style={{ height: 560, display: 'flex', flexDirection: 'column' }}>
                <RoomCanvas room={room.room} scale={PLANNER_SCALE} showGrid showDimensions
                  elements={room.elements} setElements={setRoomPart('elements')}
                  cabinets={cabs} setCabinets={setCabs}
                  selected={canvasSel} setSelected={setCanvasSel} selectedType={canvasType} setSelectedType={setCanvasType}
                  wallThickness={wallThickness} setWallThickness={setWallThickness}
                  walls={room.walls} setWalls={setRoomPart('walls')}
                  readOnly={readOnly} hideBacksplashTool hideWallsElements hideStairTool fitOnMount hideBadges
                  renderCabinet={renderCabinet} />
              </div>
            )}
            {view === 'front' && (out?.kind === 'wardrobe' ? (
              <WardrobeElevation result={out.result} design={out.design} std={std} selected={{ section: section.section, zone: section.zone }}
                onSelectSection={(i) => setSection({ section: i, zone: null })}
                onSelectZone={(i, zi) => setSection({ section: i, zone: zi })}
                onSelectRow={(i, ri) => setSection({ section: i, zone: null, row: ri })}
                zoneLabel={(z) => t(`wardrobe.zone.${z.type}`)}
                constructionLabel={`${name(unit)} · ${out.design.construction === 'shared' ? `${t('wardrobe.constructionTypes.shared')} · ${t(`wardrobe.backTypes.${out.design.backType || 'none'}`)}` : t('wardrobe.constructionTypes.boxes')}`} />
            ) : <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>{t('wardrobe.closet.pickRun')}</div>)}
            {view === '3d' && (
              <ErrorBoundary>
                <Suspense fallback={<div style={{ height: 560, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>{t('wardrobe.loading3d')}</div>}>
                  <Closet3D result={result} closet={closet} std={std} look={look} doorMode={doorMode} showWalls={showWalls} label={constructionLabel} />
                </Suspense>
              </ErrorBoundary>
            )}
            <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>{view === '3d' ? t('wardrobe.orbitHint') : t('wardrobe.closet.unitsHint')}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
            {[
              [t('wardrobe.closet.stat.units'), result.summary.unitCount ?? result.summary.runCount],
              [t('wardrobe.closet.stat.length'), result.summary.runLength],
              [t('wardrobe.stat.sections'), result.summary.sectionCount],
              [t('wardrobe.stat.doors'), result.summary.doorCount],
              [t('wardrobe.stat.parts'), result.summary.partCount],
              [t('wardrobe.stat.sheets'), sheets],
            ].map(([k, v]) => (
              <div key={k} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: DARK }}>{v}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{k}</div>
              </div>
            ))}
          </div>

          <CutListPanel result={result} std={std} materials={materialNames}
            subtitle={<>{t('wardrobe.closet.title')} · {Math.round(room.room.width)} × {Math.round(room.room.depth)} · {t('wardrobe.construction')}: <b>{constructionLabel}</b></>}
            csvName={`closet-cut-list-${Math.round(room.room.width)}x${Math.round(room.room.depth)}.csv`} />
        </div>
      </div>
    </>
  )
}
