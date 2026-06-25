import React from 'react';

export default function RegisterLayout({ role, icon, children }) {
  const roleLabels = {
    customer: 'Customer',
    architect: 'Architect / Designer',
    manufacturer: 'Manufacturer',
    supplier: 'Supplier',
  };

  return (
    <div style={styles.page}>
      <div style={styles.panel}>
        {/* Left brand strip */}
        <div style={styles.brand}>
          <div style={styles.logoMark}>W</div>
          <h1 style={styles.logoText}>WoodCalc</h1>
          <p style={styles.tagline}>Jordan's cabinet configurator platform</p>
          <div style={styles.roleTag}>{icon} {roleLabels[role]}</div>
        </div>

        {/* Right form area */}
        <div style={styles.formArea}>
          <a href="/register" style={styles.backLink}>← Choose a different role</a>
          <h2 style={styles.formTitle}>Create your account</h2>
          <p style={styles.formSub}>
            {role === 'manufacturer' || role === 'supplier'
              ? "You'll get instant limited access. Full access unlocks after document verification."
              : 'Get started in seconds.'}
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
  logoMark: {
    width: 48,
    height: 48,
    background: ACCENT,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 800,
    color: '#fff',
    marginBottom: 4,
  },
  logoText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 700,
    margin: 0,
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
