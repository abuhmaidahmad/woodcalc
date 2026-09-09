import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/LanguageContext';

const roles = [
  { key: 'customer', icon: '🏠', titleKey: 'roleSelect.customerTitle', descKey: 'roleSelect.customerDesc', path: '/register/customer' },
  { key: 'architect', icon: '📐', titleKey: 'roleSelect.architectTitle', descKey: 'roleSelect.architectDesc', path: '/register/architect' },
  { key: 'manufacturer', icon: '🏭', titleKey: 'roleSelect.manufacturerTitle', descKey: 'roleSelect.manufacturerDesc', path: '/register/manufacturer' },
  { key: 'supplier', icon: '📦', titleKey: 'roleSelect.supplierTitle', descKey: 'roleSelect.supplierDesc', path: '/register/supplier' },
];

export default function RoleSelect() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const arrow = language === 'ar' ? '←' : '→';

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.logoMark}>W</div>
          <h1 style={styles.title}>{t('roleSelect.title')}</h1>
          <p style={styles.subtitle}>{t('roleSelect.subtitle')}</p>
        </div>

        <div style={styles.grid}>
          {roles.map(role => (
            <button
              key={role.key}
              style={styles.card}
              onClick={() => navigate(role.path)}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#C8902A';
                e.currentTarget.style.boxShadow = '0 4px 24px rgba(200,144,42,0.15)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#E0DAD4';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
              }}
            >
              <span style={styles.icon}>{role.icon}</span>
              <h3 style={styles.cardTitle}>{t(role.titleKey)}</h3>
              <p style={styles.cardDesc}>{t(role.descKey)}</p>
              <span style={styles.cta}>{t('roleSelect.createAccount')} {arrow}</span>
            </button>
          ))}
        </div>

        <p style={styles.loginLink}>
          {t('roleSelect.haveAccount')}{' '}
          <a href="/login" style={styles.link}>{t('roleSelect.signIn')}</a>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#F7F4F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter', sans-serif",
    padding: 24,
  },
  container: { maxWidth: 800, width: '100%' },
  header: { textAlign: 'center', marginBottom: 40 },
  logoMark: {
    width: 56,
    height: 56,
    background: '#C8902A',
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    fontWeight: 800,
    color: '#fff',
    margin: '0 auto 16px',
  },
  title: { fontSize: 32, fontWeight: 700, color: '#1A1A1A', margin: '0 0 8px' },
  subtitle: { fontSize: 16, color: '#666', margin: 0 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
    marginBottom: 32,
  },
  card: {
    background: '#fff',
    border: '1.5px solid #E0DAD4',
    borderRadius: 14,
    padding: '28px 24px',
    textAlign: 'start',
    cursor: 'pointer',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  icon: { fontSize: 28 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#1A1A1A', margin: 0 },
  cardDesc: { fontSize: 13, color: '#666', margin: 0, lineHeight: 1.5, flex: 1 },
  cta: { fontSize: 13, color: '#C8902A', fontWeight: 600, marginTop: 4 },
  loginLink: { textAlign: 'center', color: '#666', fontSize: 14 },
  link: { color: '#C8902A', fontWeight: 600, textDecoration: 'none' },
};
