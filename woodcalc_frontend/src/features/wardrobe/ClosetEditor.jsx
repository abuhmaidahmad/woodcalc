import React, { lazy, Suspense, useState } from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import ErrorBoundary from '../../components/ErrorBoundary'
import { DOOR_TYPES, CONSTRUCTION_TYPES, BACK_TYPES, DRAWER_STYLES, withSectionCount } from './wardrobeEngine'
import { CLOSET_SHAPES, CORNER_RULES, fitRunSections } from './closetEngine'
import WardrobeElevation from './WardrobeElevation'
import ClosetPlan from './ClosetPlan'
import SectionEditor from './SectionEditor'
import ChecksCard from './ChecksCard'
import CutListPanel from './CutListPanel'
import NumField from './NumField'
import DrawerSystemPicker from './DrawerSystemPicker'
import SlidingOptions from './SlidingOptions'
import { ACCENT, DARK, FIELDSET, card, label, input, ghost } from './ui'

const Closet3D = lazy(() => import('./Closet3D'))

function Seg({ options, value, onChange, labelOf }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} style={{ ...ghost, flex: 1, background: value === o ? DARK : '#fff', color: value === o ? '#fff' : DARK }}>{labelOf(o)}</button>
      ))}
    </div>
  )
}

export default function ClosetEditor({ design, setDesign, result, std, readOnly, frontColor, constructionLabel, colorPicker }) {
  const { t } = useTranslation()
  const closet = design.closet
  const [selRun, setSelRun] = useState('A')
  const [selected, setSelected] = useState({ section: 0, zone: null })
  const [view, setView] = useState('plan')
  const [doorMode, setDoorMode] = useState('closed')

  const runIds = result.layout.walls
  const activeId = selRun === 'I' ? 'I' : runIds.includes(selRun) ? selRun : runIds[0]
  const runOut = result.runs.find((r) => r.id === activeId)
  const run = activeId === 'I' ? null : closet.runs[activeId]
  const wallLabel = (id) => t(`wardrobe.closet.wall.${id}`)

  const setCloset = (fn) => setDesign((d) => ({ ...d, closet: fn(d.closet) }))
  const setC = (k, v) => setCloset((c) => ({ ...c, [k]: v }))
  const setRun = (id, patch) => setCloset((c) => ({ ...c, runs: { ...c.runs, [id]: { ...c.runs[id], ...patch } } }))
  const setIsland = (patch) => setCloset((c) => ({ ...c, island: { ...c.island, ...patch } }))
  const setCorner = (k, v) => setCloset((c) => ({ ...c, corners: { ...c.corners, [k]: v } }))
  const pickRun = (id) => { setSelRun(id); setSelected({ section: 0, zone: null }) }
  const setRunDesign = (fn) => {
    if (!runOut) return
    const next = fn(runOut.design)
    setRun(activeId, { sections: next.sections })
  }
  const setRunCount = (n) => {
    if (!runOut) return
    setRun(activeId, { sections: withSectionCount(runOut.design, n, std).sections })
  }

  const isl = closet.island
  const sheets = result.materials.reduce((a, m) => a + m.sheets, 0)

  return (
    <div className="wb-grid">
      <fieldset className="wb-noprint" disabled={readOnly} style={FIELDSET}>
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{t('wardrobe.closet.outlineTitle')}</div>
          <span style={label}>{t('wardrobe.closet.shape')}</span>
          <Seg options={CLOSET_SHAPES} value={closet.shape} onChange={(v) => setC('shape', v)} labelOf={(o) => t(`wardrobe.closet.shapes.${o}`)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
            <NumField title={t('wardrobe.closet.width')} value={closet.width} onChange={(v) => setC('width', v ?? 0)} />
            <NumField title={t('wardrobe.closet.roomDepth')} value={closet.roomDepth} onChange={(v) => setC('roomDepth', v ?? 0)} />
            <NumField title={t('wardrobe.height')} value={closet.height} onChange={(v) => setC('height', v ?? 0)} />
          </div>
          <div style={{ marginTop: 8 }}>
            <DrawerSystemPicker value={closet.drawerSystem} onChange={(v) => setC('drawerSystem', v)} std={std} />
          </div>
          {['AB', 'AC'].filter((k) => runIds.includes(k[1])).map((k) => (
            <label key={k} style={{ display: 'block', marginTop: 8 }}>
              <span style={label}>{t('wardrobe.closet.corner', { side: wallLabel(k[1]) })}</span>
              <select style={input} value={closet.corners?.[k] || 'back'} onChange={(e) => setCorner(k, e.target.value)}>
                {CORNER_RULES.map((r) => <option key={r} value={r}>{t(`wardrobe.closet.cornerRules.${r}`, { side: wallLabel(k[1]) })}</option>)}
              </select>
            </label>
          ))}
        </div>

        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{t('wardrobe.closet.runsTitle')}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {runIds.concat(isl.enabled ? ['I'] : []).map((id) => (
                <button key={id} onClick={() => pickRun(id)}
                  style={{ ...ghost, padding: '4px 8px', background: activeId === id ? ACCENT : '#fff', color: activeId === id ? '#fff' : DARK, borderColor: activeId === id ? ACCENT : '#ddd6cc' }}>{wallLabel(id)}</button>
              ))}
            </div>
          </div>
          {run && runOut && (
            <>
              <div style={{ fontSize: 12, color: '#777', marginBottom: 8 }}>{t('wardrobe.closet.runLength', { l: Math.round(runOut.place.length) })}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <NumField title={t('wardrobe.depth')} value={run.depth} onChange={(v) => setRun(activeId, { depth: v ?? 0 })} />
                {activeId !== 'A' ? (
                  <NumField title={t('wardrobe.closet.endGap')} value={run.endGap} onChange={(v) => setRun(activeId, { endGap: v ?? 0 })} />
                ) : <div />}
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={label}>{t('wardrobe.construction')}</span>
                <Seg options={CONSTRUCTION_TYPES} value={run.construction} onChange={(v) => setRun(activeId, { construction: v })} labelOf={(o) => t(`wardrobe.constructionTypes.${o}`)} />
                {run.construction === 'shared' && (
                  <select style={{ ...input, marginTop: 8 }} value={run.backType || 'none'} onChange={(e) => setRun(activeId, { backType: e.target.value })}>
                    {BACK_TYPES.map((bt) => <option key={bt} value={bt}>{t(`wardrobe.backTypes.${bt}`)}</option>)}
                  </select>
                )}
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={label}>{t('wardrobe.doorType')}</span>
                <Seg options={DOOR_TYPES} value={run.doorType || 'none'} onChange={(v) => setRun(activeId, { doorType: v })} labelOf={(o) => t(`wardrobe.doorTypes.${o}`)} />
                {run.doorType === 'sliding' && (
                  <SlidingOptions value={run} onChange={(patch) => setRun(activeId, patch)} autoDoors={runOut.result.bought?.find((b) => b.key === 'slidingDoor')?.qty} />
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10, alignItems: 'end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, paddingBottom: 8 }}>
                  <input type="checkbox" checked={!!run.loft} onChange={(e) => setRun(activeId, { loft: e.target.checked })} />
                  {t('wardrobe.loft')}
                </label>
                <NumField title={t('wardrobe.loftH')} value={run.loftH} disabled={!run.loft} onChange={(v) => setRun(activeId, { loftH: v ?? 0 })} />
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={label}>{t('wardrobe.sections')}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button style={ghost} onClick={() => setRunCount(run.sections.length - 1)}>−</button>
                  <div style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{run.sections.length}</div>
                  <button style={ghost} onClick={() => setRunCount(run.sections.length + 1)}>+</button>
                  <button style={ghost} onClick={() => setCloset((c) => fitRunSections(c, activeId, std))}>{t('wardrobe.autoSections')}</button>
                </div>
              </div>
            </>
          )}
          {activeId === 'I' && <div style={{ fontSize: 12, color: '#777' }}>{t('wardrobe.closet.islandSelected')}</div>}
        </div>

        {run && runOut && (
          <SectionEditor design={runOut.design} setDesign={setRunDesign} result={runOut.result} std={std}
            selected={selected} setSelected={setSelected} title={wallLabel(activeId)} />
        )}

        <div style={card}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
            <input type="checkbox" checked={!!isl.enabled} onChange={(e) => setIsland({ enabled: e.target.checked })} />
            {t('wardrobe.closet.island')}
          </label>
          {isl.enabled && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
                <NumField title={t('wardrobe.width')} value={isl.width} onChange={(v) => setIsland({ width: v ?? 0 })} />
                <NumField title={t('wardrobe.depth')} value={isl.depth} onChange={(v) => setIsland({ depth: v ?? 0 })} />
                <NumField title={t('wardrobe.height')} value={isl.height} onChange={(v) => setIsland({ height: v ?? 0 })} />
                <NumField title={t('wardrobe.closet.bays')} value={isl.bays} min={1} onChange={(v) => setIsland({ bays: v || 1 })} />
                <NumField title={t('wardrobe.closet.drawersPerBay')} value={isl.drawers} min={1} onChange={(v) => setIsland({ drawers: v || 1 })} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, paddingTop: 18 }}>
                  <input type="checkbox" checked={!!isl.doubleSided} onChange={(e) => setIsland({ doubleSided: e.target.checked })} />
                  {t('wardrobe.closet.doubleSided')}
                </label>
                <NumField title={t('wardrobe.closet.moveX')} value={isl.dx} min={-100000} onChange={(v) => setIsland({ dx: v ?? 0 })} />
                <NumField title={t('wardrobe.closet.moveY')} value={isl.dy} min={-100000} onChange={(v) => setIsland({ dy: v ?? 0 })} />
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={label}>{t('wardrobe.construction')}</span>
                <Seg options={CONSTRUCTION_TYPES} value={isl.construction} onChange={(v) => setIsland({ construction: v })} labelOf={(o) => t(`wardrobe.constructionTypes.${o}`)} />
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={label}>{t('wardrobe.closet.drawerStyle')}</span>
                <Seg options={DRAWER_STYLES} value={isl.drawerStyle === 'internal' ? 'internal' : 'external'} onChange={(v) => setIsland({ drawerStyle: v })} labelOf={(o) => t(`wardrobe.closet.drawerStyles.${o}`)} />
              </div>
              <div style={{ marginTop: 10 }}>
                <DrawerSystemPicker value={isl.drawerSystem} onChange={(v) => setIsland({ drawerSystem: v })} std={std} />
              </div>
            </>
          )}
        </div>

        <ChecksCard warnings={result.warnings} runLabel={(r) => (r.startsWith('I') ? wallLabel('I') + (r.length > 1 ? ` ${r.slice(1)}` : '') : wallLabel(r))} />
      </fieldset>

      <div className="wb-print-full" style={{ minWidth: 0 }}>
        <div style={{ ...card, padding: 12 }} className="wb-noprint">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['plan', 'front', '3d'].map((v) => (
                <button key={v} onClick={() => setView(v)} style={{ ...ghost, background: view === v ? DARK : '#fff', color: view === v ? '#fff' : DARK }}>
                  {v === 'front' && runOut ? `${t('wardrobe.view.front')} · ${wallLabel(activeId)}` : t(`wardrobe.closet.view.${v}`)}
                </button>
              ))}
            </div>
            {view === '3d' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {['closed', 'open', 'hidden'].map((m) => (
                  <button key={m} onClick={() => setDoorMode(m)} style={{ ...ghost, borderColor: doorMode === m ? ACCENT : '#ddd6cc', color: doorMode === m ? ACCENT : DARK }}>{t(`wardrobe.doorMode.${m}`)}</button>
                ))}
                {colorPicker}
              </div>
            )}
          </div>
          {view === 'plan' && <ClosetPlan result={result} selected={activeId} onSelect={pickRun} wallLabel={wallLabel} />}
          {view === 'front' && (runOut ? (
            <WardrobeElevation result={runOut.result} design={runOut.design} std={std} selected={{ section: selected.section, zone: selected.zone }}
              onSelectSection={(i) => setSelected({ section: i, zone: null })}
              onSelectZone={(i, zi) => setSelected({ section: i, zone: zi })}
              zoneLabel={(z) => t(`wardrobe.zone.${z.type}`)}
              constructionLabel={`${wallLabel(activeId)} · ${runOut.design.construction === 'shared' ? `${t('wardrobe.constructionTypes.shared')} · ${t(`wardrobe.backTypes.${runOut.design.backType || 'none'}`)}` : t('wardrobe.constructionTypes.boxes')}`} />
          ) : <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>{t('wardrobe.closet.pickRun')}</div>)}
          {view === '3d' && (
            <ErrorBoundary>
              <Suspense fallback={<div style={{ height: 560, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>{t('wardrobe.loading3d')}</div>}>
                <Closet3D result={result} closet={closet} std={std} frontColor={frontColor} carcassColor="#f1ede6" doorMode={doorMode} label={constructionLabel} />
              </Suspense>
            </ErrorBoundary>
          )}
          <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>{view === '3d' ? t('wardrobe.orbitHint') : t('wardrobe.closet.planHint')}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
          {[
            [t('wardrobe.closet.stat.runs'), result.summary.runCount],
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

        <CutListPanel result={result} std={std}
          subtitle={<>{t('wardrobe.closet.title')} · {t(`wardrobe.closet.shapes.${closet.shape}`)} · {Math.round(closet.width)} × {Math.round(closet.roomDepth)} × {Math.round(closet.height)} · {t('wardrobe.construction')}: <b>{constructionLabel}</b></>}
          csvName={`closet-cut-list-${Math.round(closet.width)}x${Math.round(closet.roomDepth)}.csv`} />
      </div>
    </div>
  )
}
