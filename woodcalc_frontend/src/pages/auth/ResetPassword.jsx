import React, { useState, useEffect } from 'react';
import { confirmPasswordReset } from '../../api/auth';
import { useTranslation } from '../../i18n/LanguageContext';
import Logo from '../../components/Logo';

export default function ResetPassword() {
  const { t, language } = useTranslation();
  const [token, setToken] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') || '');
  }, []);

  const handleSubmit = async () => {
    setError('');
    if (password.length < 8) {
      setError(t('resetPassword.errTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('resetPassword.errMismatch'));
      return;
    }
    setLoading(true);
    const res = await confirmPasswordReset(token, password);
    setLoading(false);
    if (res.ok) {
      setDone(true);
    } else {
      setError(res.detail || t('resetPassword.errGeneric'));
    }
  };

  if (token === null) return null;

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} style={styles.page}>
      <div style={styles.card}>
        <Logo height={44} style={{ margin: '0 auto 20px' }} />

        {!token ? (
          <>
            <h1 style={styles.title}>{t('resetPassword.missingTokenTitle')}</h1>
            <p style={styles.subtitle}>{t('resetPassword.missingTokenMessage')}</p>
            <p style={styles.registerLink}>
              <a href="/forgot-password" style={styles.link}>{t('resetPassword.requestNewLink')}</a>
            </p>
          </>
        ) : done ? (
          <>
            <h1 style={styles.title}>{t('resetPassword.doneTitle')}</h1>
            <p style={styles.subtitle}>{t('resetPassword.doneMessage')}</p>
            <p style={styles.registerLink}>
              <a href="/login" style={styles.link}>{t('forgotPassword.backToLogin')}</a>
            </p>
          </>
        ) : (
          <>
            <h1 style={styles.title}>{t('resetPassword.title')}</h1>
            <p style={styles.subtitle}>{t('resetPassword.subtitle')}</p>

            <div style={styles.field}>
              <label style={styles.label}>{t('resetPassword.newPasswordLabel')}</label>
              <input
                type="password"
                placeholder={t('resetPassword.newPasswordPlaceholder')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={styles.input}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>{t('resetPassword.confirmPasswordLabel')}</label>
              <input
                type="password"
                placeholder={t('resetPassword.confirmPasswordPlaceholder')}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={styles.input}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <button style={styles.btn} onClick={handleSubmit} disabled={loading}>
              {loading ? t('resetPassword.saving') : t('resetPassword.submit')}
            </button>

            <p style={styles.registerLink}>
              <a href="/forgot-password" style={styles.link}>{t('resetPassword.requestNewLink')}</a>
            </p>
          </>
        )}
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
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '48px 40px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 8px 48px rgba(0,0,0,0.10)',
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1A1A1A',
    margin: '0 0 6px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    margin: '0 0 32px',
    lineHeight: 1.6,
  },
  field: { marginBottom: 18 },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#333',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid #E0DAD4',
    borderRadius: 8,
    fontSize: 14,
    color: '#1A1A1A',
    background: '#FAFAFA',
    outline: 'none',
    boxSizing: 'border-box',
  },
  error: {
    color: '#D94040',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  btn: {
    width: '100%',
    padding: '13px',
    background: '#C8902A',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 4,
  },
  registerLink: {
    textAlign: 'center',
    color: '#666',
    fontSize: 13,
    marginTop: 20,
  },
  link: {
    color: '#C8902A',
    fontWeight: 600,
    textDecoration: 'none',
  },
};
