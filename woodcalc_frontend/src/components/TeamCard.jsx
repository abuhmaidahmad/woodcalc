import React, { useState, useEffect } from 'react'
import { getCompany, hasPermission } from '../api/auth'
import { listMembers, createMember, updateMember, removeMember, listPermissions } from '../api/hr'
import { useTranslation } from '../i18n/LanguageContext'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

const ROLE_KEYS = { owner: 'team.roleOwner', admin: 'team.roleAdmin', staff: 'team.roleStaff' }

const EMPTY_FORM = { first_name: '', last_name: '', email: '', password: '', role: 'staff', permissions: [] }

export default function TeamCard() {
  const { t } = useTranslation()
  const company = getCompany()
  const [members, setMembers] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canManage = hasPermission('team.manage_members')

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [m, p] = await Promise.all([listMembers(), listPermissions()])
      setMembers(Array.isArray(m) ? m : (m.results || []))
      setPermissions(Array.isArray(p) ? p : [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { if (canManage) fetchAll() }, [])

  if (!company || !canManage) return null

  const togglePermission = (memberOrForm, setFn, code) => {
    const current = memberOrForm.permissions || []
    const next = current.includes(code) ? current.filter(c => c !== code) : [...current, code]
    setFn(next)
  }

  const saveMemberPermissions = async (member, next) => {
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, permissions: next } : m))
    await updateMember(member.id, { permissions: next })
  }

  const changeRole = async (member, role) => {
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, role } : m))
    await updateMember(member.id, { role })
  }

  const doRemove = async (member) => {
    if (!window.confirm(t('team.removeConfirm'))) return
    await removeMember(member.id)
    fetchAll()
  }

  const createTeammate = async () => {
    if (!form.email.trim() || !form.first_name.trim() || form.password.length < 8) return
    setSaving(true)
    setError('')
    try {
      const res = await createMember(form)
      if (res.id) {
        setForm(EMPTY_FORM)
        setShowAdd(false)
        fetchAll()
      } else {
        setError(t('team.errCreateFailed', { err: JSON.stringify(res) }))
      }
    } catch {
      setError(t('team.errCreateFailed', { err: '' }))
    }
    setSaving(false)
  }

  const activeCount = members.filter(m => m.user?.is_active).length
  const atLimit = company.max_users && activeCount >= company.max_users

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 20 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: DARK }}>{t('team.title')}</h2>
      <div style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>{t('team.desc')}</div>

      {loading ? (
        <div style={{ color: '#bbb', fontSize: 13 }}>{t('common.loading')}</div>
      ) : (
        <>
          {members.length === 0 && (
            <div style={{ color: '#bbb', fontSize: 12, marginBottom: 16 }}>{t('team.noMembersYet')}</div>
          )}

          {members.map(m => (
            <div key={m.id} style={{ border: '1px solid #F0EBE5', borderRadius: 8, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>
                    {m.user?.first_name} {m.user?.last_name}
                    {!m.user?.is_active && <span style={{ color: '#c33', fontSize: 11, marginInlineStart: 6 }}>({t('team.inactive')})</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>{m.user?.email}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {m.role === 'owner' ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, padding: '4px 10px', border: `1.5px solid ${ACCENT}`, borderRadius: 6 }}>
                      {t('team.roleOwner')}
                    </span>
                  ) : (
                    <select value={m.role} onChange={e => changeRole(m, e.target.value)}
                      style={{ fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6, border: '1.5px solid #E0DAD4', background: '#fff', color: DARK, cursor: 'pointer' }}>
                      <option value="admin">{t('team.roleAdmin')}</option>
                      <option value="staff">{t('team.roleStaff')}</option>
                    </select>
                  )}
                  {m.role !== 'owner' && (
                    <button onClick={() => doRemove(m)}
                      style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', background: '#FEF2F2', color: '#E74C3C', border: '1.5px solid #FECACA', borderRadius: 6, cursor: 'pointer' }}>
                      {t('team.remove')}
                    </button>
                  )}
                </div>
              </div>
              {m.role !== 'owner' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {permissions.map(p => {
                    const codeKey = p.code.replace(/\./g, '_')
                    const active = (m.permissions || []).includes(p.code)
                    return (
                      <button key={p.code}
                        onClick={() => saveMemberPermissions(m, active ? (m.permissions || []).filter(c => c !== p.code) : [...(m.permissions || []), p.code])}
                        style={{ fontSize: 10, fontWeight: 600, padding: '4px 8px', borderRadius: 12, cursor: 'pointer',
                          border: `1.5px solid ${active ? ACCENT : '#E0DAD4'}`,
                          background: active ? ACCENT + '18' : '#fff',
                          color: active ? ACCENT : '#888' }}>
                        {t('team.permCode.' + codeKey)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}

          {!showAdd ? (
            <button onClick={() => setShowAdd(true)} disabled={atLimit}
              style={{ padding: '8px 16px', background: atLimit ? '#E0DAD4' : ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: atLimit ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700 }}>
              {t('team.addMember')}
            </button>
          ) : (
            <div style={{ border: '1.5px solid #E0DAD4', borderRadius: 8, padding: 16, marginTop: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  placeholder={t('team.firstName')}
                  style={{ padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 12, outline: 'none' }} />
                <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  placeholder={t('team.lastName')}
                  style={{ padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 12, outline: 'none' }} />
              </div>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder={t('team.email')}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
              <input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={t('team.password')}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ fontSize: 10, color: '#999', marginTop: 4, marginBottom: 8 }}>{t('team.passwordHint')}</div>

              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{t('team.role')}</div>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                style={{ padding: '6px 10px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 12, marginBottom: 10 }}>
                <option value="admin">{t('team.roleAdmin')}</option>
                <option value="staff">{t('team.roleStaff')}</option>
              </select>

              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{t('team.permissions')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {permissions.map(p => {
                  const codeKey = p.code.replace(/\./g, '_')
                  const active = form.permissions.includes(p.code)
                  return (
                    <button key={p.code}
                      onClick={() => togglePermission(form, next => setForm(f => ({ ...f, permissions: next })), p.code)}
                      style={{ fontSize: 10, fontWeight: 600, padding: '4px 8px', borderRadius: 12, cursor: 'pointer',
                        border: `1.5px solid ${active ? ACCENT : '#E0DAD4'}`,
                        background: active ? ACCENT + '18' : '#fff',
                        color: active ? ACCENT : '#888' }}>
                      {t('team.permCode.' + codeKey)}
                    </button>
                  )
                })}
              </div>

              {error && <div style={{ fontSize: 11, color: '#c33', marginBottom: 8 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); setError('') }}
                  style={{ flex: 1, padding: '8px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#666' }}>
                  {t('team.cancel')}
                </button>
                <button onClick={createTeammate} disabled={saving}
                  style={{ flex: 2, padding: '8px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  {saving ? t('team.saving') : t('team.create')}
                </button>
              </div>
            </div>
          )}

          {atLimit && (
            <div style={{ fontSize: 11, color: '#c33', marginTop: 8 }}>
              {t('team.seatLimit', { count: activeCount, max: company.max_users })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
