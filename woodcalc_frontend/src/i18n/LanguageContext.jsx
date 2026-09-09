import React, { createContext, useContext, useEffect, useState } from 'react'
import en from './en.json'
import ar from './ar.json'

const DICTIONARIES = { en, ar }
export const LanguageCtx = createContext(null)

function lookup(dict, key) {
  return key.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), dict)
}

function interpolate(str, vars) {
  if (!vars) return str
  return str.replace(/\{\{(\w+)\}\}/g, (match, name) => (name in vars ? vars[name] : match))
}

function detectInitialLanguage() {
  try {
    const stored = localStorage.getItem('language')
    if (stored === 'en' || stored === 'ar') return stored
  } catch {}
  return typeof navigator !== 'undefined' && navigator.language?.startsWith('ar') ? 'ar' : 'en'
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(detectInitialLanguage)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = (lang) => {
    setLanguageState(lang)
    try { localStorage.setItem('language', lang) } catch {}
  }

  const t = (key, vars) => {
    const value = lookup(DICTIONARIES[language], key) ?? lookup(DICTIONARIES.en, key) ?? key
    return typeof value === 'string' ? interpolate(value, vars) : value
  }

  return (
    <LanguageCtx.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageCtx.Provider>
  )
}

export function useTranslation() {
  const ctx = useContext(LanguageCtx)
  if (!ctx) throw new Error('useTranslation must be used within a LanguageProvider')
  return ctx
}
