import React from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import Logo from '../Logo';

export default function RegisterLayout({ role, icon, children }) {
  const { t, language } = useTranslation();
  const arrow = language === 'ar' ? '→' : '←';
  const roleLabels = {
    customer: t('registerLayout.roleCustomer'),
    architect: t('registerLayout.roleArchitect'),
    manufacturer: t('registerLayout.roleManufacturer'),
    supplier: t('registerLayout.roleSupplier'),
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} style={styles.page}>
      <div style={styles.panel}>
        {/* Left brand strip */}
        <div style={styles.brand}>
          <Logo forDarkBg height={36} style={{ marginBottom: 4, alignSelf: 'flex-start' }} />
          <p style={styles.tagline}>{t('registerLayout.tagline')}</p>
          <div style={styles.roleTag}>{icon} {roleLabels[role]}</div>
        </div>

        {/* Right form area */}
        <div style={styles.formArea}>
          <a href="/register" style={styles.backLink}>{arrow} {t('registerLayout.backLink')}</a>
          <h2 style={styles.formTitle}>{t('registerLayout.formTitle')}</h2>
          <p style={styles.formSub}>
            {role === 'manufacturer' || role === 'supplier'
              ? t('registerLayout.formSubVerified')
              : t('registerLayout.formSubDefault')}
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}

const DARK = '#1A1A1A';
const LIGHT = '#F7F4F0';
const ACCENT = '#C8902A';

const styles = {
  page: {
    minHeight: '100vh',
    background: LIGHT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter', sans-serif",
    padding: '24px',
  },
  panel: {
    display: 'flex',
    width: '100%',
    maxWidth: 960,
    minHeight: 580,
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 8px 48px rgba(0,0,0,0.12)',
  },
  brand: {
    width: 280,
    background: DARK,
    padding: '48px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    flexShrink: 0,
  },
  tagline: {
    color: '#888',
    fontSize: 13,
    margin: 0,
    lineHeight: 1.5,
  },
  roleTag: {
    marginTop: 'auto',
    background: 'rgba(200,144,42,0.15)',
    border: '1px solid rgba(200,144,42,0.3)',
    color: ACCENT,
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 600,
  },
  formArea: {
    flex: 1,
    background: '#fff',
    padding: '48px 40px',
    overflowY: 'auto',
  },
  backLink: {
    color: '#999',
    fontSize: 13,
    textDecoration: 'none',
    display: 'block',
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: 700,
    color: DARK,
    margin: '0 0 6px',
  },
  formSub: {
    color: '#666',
    fontSize: 14,
    margin: '0 0 28px',
    lineHeight: 1.6,
  },
};
