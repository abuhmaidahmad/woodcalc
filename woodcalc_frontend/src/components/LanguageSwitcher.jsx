import React from 'react'
import { useTranslation } from '../i18n/LanguageContext'

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useTranslation()

  return (
    <div dir="ltr" style={{ position: 'fixed', top: 12, right: 12, zIndex: 2500, display: 'flex', background: '#1A1A1A', borderRadius: 20, padding: 3, boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
      <button onClick={() => setLanguage('en')}
        style={{
          padding: '5px 12px', borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
          background: language === 'en' ? '#C8902A' : 'transparent', color: language === 'en' ? '#fff' : '#999',
        }}>
        {t('languageSwitcher.en')}
      </button>
      <button onClick={() => setLanguage('ar')}
        style={{
          padding: '5px 12px', borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
          background: language === 'ar' ? '#C8902A' : 'transparent', color: language === 'ar' ? '#fff' : '#999',
        }}>
        {t('languageSwitcher.ar')}
      </button>
    </div>
  )
}
