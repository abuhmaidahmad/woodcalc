import React from 'react';
import { useNavigate } from 'react-router-dom';

const roles = [
  {
    key: 'customer',
    icon: '🏠',
    title: 'Customer',
    description: 'Configure and order kitchen cabinets for your home or project.',
    path: '/register/customer',
  },
  {
    key: 'architect',
    icon: '📐',
    title: 'Architect / Designer',
    description: 'Spec and propose cabinets for your clients with professional tools.',
    path: '/register/architect',
  },
  {
    key: 'manufacturer',
    icon: '🏭',
    title: 'Manufacturer',
    description: 'Receive orders, manage production, and grow your factory business.',
    path: '/register/manufacturer',
  },
  {
    key: 'supplier',
    icon: '📦',
    title: 'Supplier',
    description: 'List your materials and reach manufacturers across Jordan.',
    path: '/register/supplier',
  },
];

export default function RoleSelect() {
  const navigate = useNavigate();

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.logoMark}>W</div>
          <h1 style={styles.title}>Join WoodCalc</h1>
          <p style={styles.subtitle}>Choose your role to get started</p>
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
              <h3 style={styles.cardTitle}>{role.title}</h3>
              <p style={styles.cardDesc}>{role.description}</p>
              <span style={styles.cta}>Create account →</span>
            </button>
          ))}
        </div>

        <p style={styles.loginLink}>
          Already have an account?{' '}
          <a href="/login" style={styles.link}>Sign in</a>
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
    textAlign: 'left',
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
