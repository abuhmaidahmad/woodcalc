import React, { useCallback, useState } from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import RoomCanvas from '../kitchen_planner/RoomCanvas'
import { ROOM_ELEMENTS, RoomElementPalette, ElementProperties } from '../kitchen_planner/RoomElementsPanel'
import { useDesignHistory } from '../kitchen_planner/designHistory'
import { DEFAULT_WALL_THICKNESS, PLANNER_SCALE } from '../kitchen_planner/wallGeometry'
import { CLOSET_ROOM_ELEMENT_TYPES, closetRoom, outlineRoom } from './closetRoom'
import NumField from './NumField'
import { ACCENT, DARK, card, ghost, label } from './ui'

const ITEMS = ROOM_ELEMENTS.filter((el) => CLOSET_ROOM_ELEMENT_TYPES.includes(el.type))

const styles = {
  elementItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 9px', border: '1.5px solid #E0DAD4', borderRadius: 8, marginBottom: 6, cursor: 'pointer', background: '#FAFAFA' },
  elementLabel: { fontSize: 12, fontWeight: 600, color: DARK },
  elementSize: { fontSize: 10, color: '#999' },
  propTitle: { fontSize: 14, fontWeight: 800, color: DARK, marginBottom: 8 },
  propSection: { fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '12px 0 6px' },
  propLabel: { fontSize: 11, color: '#777', marginBottom: 4 },
  propInput: { width: '100%', boxSizing: 'border-box', padding: '7px 9px', border: '1px solid #ddd6cc', borderRadius: 7, fontSize: 13, background: '#fff' },
  deleteBtn: { width: '100%', padding: '8px', marginTop: 6, background: '#fff', color: '#c0392b', border: '1.5px solid #f0c4be', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 },
}

export default function ClosetRoomStep({ closet, setCloset, readOnly }) {
  const { t } = useTranslation()
  const room = closetRoom(closet)
  const [selected, setSelected] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [wallThickness, setWallThickness] = useState(DEFAULT_WALL_THICKNESS)
  const [showGrid, setShowGrid] = useState(true)
  const [showDimensions, setShowDimensions] = useState(true)

  const setRoom = useCallback((fn) => {
    if (readOnly) return
    setCloset((c) => ({ ...c, room: fn(closetRoom(c)) }))
  }, [readOnly, setCloset])
  const setWalls = useCallback((u) => setRoom((r) => ({ ...r, walls: typeof u === 'function' ? u(r.walls) : u })), [setRoom])
  const setElements = useCallback((u) => setRoom((r) => ({ ...r, elements: typeof u === 'function' ? u(r.elements) : u })), [setRoom])
  const apply = useCallback((snap) => setRoom(() => snap), [setRoom])
  const history = useDesignHistory(room, apply, { disabled: readOnly })

  const selEl = selectedType === 'element' ? room.elements.find((e) => e.id === selected) : null
  const updateEl = (key, val) => setElements((list) => list.map((e) => (e.id === selected ? { ...e, [key]: val } : e)))
  const addElement = (tpl) => {
    const el = { ...tpl, id: Date.now() + 1, x: Math.round(room.room.width / 2), y: Math.round(room.room.depth / 2) }
    setElements((list) => [...list, el])
    setSelected(el.id)
    setSelectedType('element')
  }

  return (
    <div className="wb-room-grid">
      <style>{'.wb-room-grid { display: grid; grid-template-columns: 220px minmax(0, 1fr) 250px; gap: 14px } @media (max-width: 1100px) { .wb-room-grid { grid-template-columns: 1fr } }'}</style>
      <fieldset className="wb-noprint" disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{t('wardrobe.room.roomTitle')}</div>
          <NumField title={t('wardrobe.room.ceilingHeight')} value={room.room.ceilingHeight}
            onChange={(v) => setRoom((r) => ({ ...r, room: { ...r.room, ceilingHeight: v ?? 0 } }))} />
          <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>{t('wardrobe.room.roomHint')}</div>
          <button style={{ ...ghost, marginTop: 10, width: '100%' }} onClick={() => setRoom(() => outlineRoom(closet))}>{t('wardrobe.room.rebuildRoom')}</button>
        </div>
        <div style={card}>
          <span style={label}>{t('kitchenPlannerModule.roomElements')}</span>
          <RoomElementPalette items={ITEMS} onAdd={addElement} styles={styles} />
          <div style={{ fontSize: 11, color: '#999' }}>{t('wardrobe.room.pillarHint')}</div>
        </div>
        <div style={card}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />{t('kitchenPlannerModule.showGrid')}
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            <input type="checkbox" checked={showDimensions} onChange={(e) => setShowDimensions(e.target.checked)} />{t('kitchenPlannerModule.showDimensions')}
          </label>
        </div>
      </fieldset>

      <div style={{ ...card, padding: 0, overflow: 'hidden', height: 600, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <RoomCanvas room={room.room} scale={PLANNER_SCALE} showGrid={showGrid} showDimensions={showDimensions}
          elements={room.elements} setElements={setElements}
          selected={selected} setSelected={setSelected} selectedType={selectedType} setSelectedType={setSelectedType}
          wallThickness={wallThickness} setWallThickness={setWallThickness}
          walls={room.walls} setWalls={setWalls}
          onUndo={history.undo} onRedo={history.redo} canUndo={history.canUndo} canRedo={history.canRedo}
          readOnly={readOnly} hideBacksplashTool hideStairTool fitOnMount />
      </div>

      <fieldset className="wb-noprint" disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div style={card}>
          {selEl ? (
            <ElementProperties el={selEl} walls={room.walls} scale={PLANNER_SCALE} styles={styles} onChange={updateEl}
              onDelete={() => { setElements((list) => list.filter((e) => e.id !== selected)); setSelected(null); setSelectedType(null) }} />
          ) : (
            <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: '24px 6px' }}>
              <div style={{ fontSize: 24, marginBottom: 6, color: ACCENT }}>👆</div>
              {t('kitchenPlannerModule.clickElementToEdit')}
            </div>
          )}
        </div>
      </fieldset>
    </div>
  )
}
