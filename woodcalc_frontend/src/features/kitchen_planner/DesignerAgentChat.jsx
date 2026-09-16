import React, { useState, useRef, useEffect } from 'react'
import { authFetch, withCompanyParam } from '../../api/auth'
import { useTranslation } from '../../i18n/LanguageContext'

const API_URL = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'
const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

function ProposalCard({ proposal, onAdd, onSave, saveState }) {
  const { t } = useTranslation()
  return (
    <div style={{ border: `1.5px solid ${ACCENT}`, borderRadius: 10, background: ACCENT + '0C', padding: 10, marginTop: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: DARK, marginBottom: 2 }}>{proposal.name}</div>
      <div style={{ fontSize: 10, color: '#888', fontFamily: 'monospace', marginBottom: 4 }}>
        {proposal.width}×{proposal.depth}×{proposal.height}mm · {proposal.category} · {proposal.subtype}
      </div>
      {proposal.explanation && (
        <div style={{ fontSize: 11, color: '#555', lineHeight: 1.4, marginBottom: 8 }}>{proposal.explanation}</div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onAdd}
          style={{ flex: 1, padding: '7px 8px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
          {t('designerAgent.addToCanvas')}
        </button>
        <button onClick={onSave} disabled={saveState === 'saving' || saveState === 'saved'}
          style={{ flex: 1, padding: '7px 8px', background: saveState === 'saved' ? '#E8F5E9' : '#fff', color: saveState === 'saved' ? '#2e7d32' : ACCENT,
            border: `1.5px solid ${saveState === 'saved' ? '#2e7d32' : ACCENT}`, borderRadius: 6, cursor: saveState === 'saving' ? 'wait' : 'pointer', fontSize: 11, fontWeight: 700 }}>
          {saveState === 'saved' ? t('designerAgent.saved') : saveState === 'saving' ? t('designerAgent.saving') : t('designerAgent.saveToLibrary')}
        </button>
      </div>
      {saveState === 'error' && (
        <div style={{ fontSize: 10, color: '#c33', marginTop: 4 }}>{t('designerAgent.saveError')}</div>
      )}
    </div>
  )
}

export default function DesignerAgentChat({ onAddCabinet, companySlug }) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState([])       // [{role, content, proposal?, saveState?}]
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [notConfigured, setNotConfigured] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [entries, sending])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setError('')
    const nextEntries = [...entries, { role: 'user', content: text }]
    setEntries(nextEntries)
    setSending(true)
    try {
      const res = await authFetch(withCompanyParam(API_URL + '/api/inventory/designer-agent/chat/', companySlug), {
        method: 'POST',
        body: JSON.stringify({ messages: nextEntries.map(e => ({ role: e.role, content: e.content })) }),
      })
      if (res.status === 503) {
        setNotConfigured(true)
        setEntries(nextEntries)
        setSending(false)
        return
      }
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || t('designerAgent.genericError'))
        setSending(false)
        return
      }
      setEntries([...nextEntries, { role: 'assistant', content: data.reply, proposal: data.proposal || null, saveState: null }])
    } catch {
      setError(t('designerAgent.networkError'))
    }
    setSending(false)
  }

  const handleAdd = (proposal) => {
    onAddCabinet({
      id: `ai-${Date.now()}`,
      label: proposal.name,
      category: proposal.category,
      subtype: proposal.subtype || 'Custom',
      width: proposal.width,
      height: proposal.height,
      depth: proposal.depth,
      icon: 'specialty_custom',
      doorCount: proposal.door_count ?? undefined,
      shelves: proposal.shelves ?? undefined,
      drawerSystem: proposal.drawer_system || undefined,
      wallHeight: proposal.wall_height ?? undefined,
      elevation: proposal.elevation ?? 0,
      isCustom: true,
    })
  }

  const handleSave = async (idx, proposal) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, saveState: 'saving' } : e))
    try {
      const res = await authFetch(withCompanyParam(API_URL + '/api/inventory/cabinet-templates/', companySlug), {
        method: 'POST',
        body: JSON.stringify({
          name: proposal.name,
          category: proposal.category,
          subtype: proposal.subtype || 'Custom',
          width: proposal.width,
          height: proposal.height,
          depth: proposal.depth,
          wall_height: proposal.wall_height ?? null,
          elevation: proposal.elevation ?? null,
          door_count: proposal.door_count ?? null,
          shelves: proposal.shelves ?? null,
          drawer_system: proposal.drawer_system || '',
          icon: 'specialty_custom',
          source_conversation: entries.map(e => ({ role: e.role, content: e.content })),
        }),
      })
      setEntries(prev => prev.map((e, i) => i === idx ? { ...e, saveState: res.ok ? 'saved' : 'error' } : e))
    } catch {
      setEntries(prev => prev.map((e, i) => i === idx ? { ...e, saveState: 'error' } : e))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 10px 6px', borderBottom: '1px solid #E8E4DF', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: DARK }}>{t('designerAgent.title')}</div>
        <div style={{ fontSize: 10, color: '#999', lineHeight: 1.4 }}>{t('designerAgent.subtitle')}</div>
      </div>

      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {entries.length === 0 && !notConfigured && (
          <div style={{ fontSize: 11, color: '#bbb', textAlign: 'center', paddingTop: 30 }}>{t('designerAgent.emptyState')}</div>
        )}
        {entries.map((e, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: e.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
            <div style={{ maxWidth: '90%' }}>
              <div style={{
                padding: '7px 10px', borderRadius: 10, fontSize: 12, lineHeight: 1.4,
                background: e.role === 'user' ? ACCENT : '#F5F0E8',
                color: e.role === 'user' ? '#fff' : DARK,
              }}>
                {e.content}
              </div>
              {e.proposal && (
                <ProposalCard
                  proposal={e.proposal}
                  onAdd={() => handleAdd(e.proposal)}
                  onSave={() => handleSave(idx, e.proposal)}
                  saveState={e.saveState}
                />
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ fontSize: 11, color: '#bbb', paddingLeft: 4 }}>{t('designerAgent.thinking')}</div>
        )}
        {notConfigured && (
          <div style={{ fontSize: 11, color: '#c33', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 8, padding: 10, marginTop: 6 }}>
            {t('designerAgent.notConfigured')}
          </div>
        )}
        {error && (
          <div style={{ fontSize: 11, color: '#c33', marginTop: 4 }}>{error}</div>
        )}
      </div>

      <div style={{ padding: 10, borderTop: '1px solid #E8E4DF', flexShrink: 0, display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={t('designerAgent.inputPlaceholder')}
          disabled={notConfigured}
          style={{ flex: 1, padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }}
        />
        <button onClick={send} disabled={!input.trim() || sending || notConfigured}
          style={{ padding: '8px 14px', background: (!input.trim() || sending || notConfigured) ? '#E0DAD4' : ACCENT, color: '#fff', border: 'none', borderRadius: 7, cursor: (!input.trim() || sending || notConfigured) ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700 }}>
          {t('designerAgent.send')}
        </button>
      </div>
    </div>
  )
}
