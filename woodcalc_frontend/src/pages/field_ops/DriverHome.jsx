import React from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import { FieldTopBar, Section } from '../../components/field_ops/fieldOpsUi'
import { BG, useDir } from '../../components/field_ops/fieldOpsTheme'

export default function DriverHome() {
  const { t } = useTranslation()
  const dir = useDir()
  return (
    <div dir={dir} style={{ minHeight: '100vh', background: BG, fontFamily: "'Inter', sans-serif" }}>
      <FieldTopBar title={t('fieldOps.driverTitle')} />
      <main style={{ maxWidth: 640, marginInline: 'auto', padding: 16, paddingBottom: 96 }}>
        <Section><div style={{ fontSize: 16, color: '#555' }}>{t('fieldOps.driverComingSoon')}</div></Section>
      </main>
    </div>
  )
}
