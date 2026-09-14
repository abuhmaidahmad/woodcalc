import React, { useState } from 'react';
import { requestPasswordReset } from '../../api/auth';
import { useTranslation } from '../../i18n/LanguageContext';
import Logo from '../../components/Logo';

export default function ForgotPassword() {
  const { t, language } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email) return;
    setLoading(true);
    await requestPasswordReset(email);
    setLoading(false);
    setSent(true);
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} style={styles.page}>
      <div style={styles.card}>
        <Logo height={44} style={{ margin: '0 auto 20px' }} />

        {sent ? (
          <>
            <h1 style={styles.title}>{t('forgotPassword.sentTitle')}</h1>
            <p style={styles.subtitle}>{t('forgotPassword.sentMessage')}</p>
            <p style={styles.registerLink}>
              <a href="/login" style={styles.link}>{t('forgotPassword.backToLogin')}</a>
            </p>
          </>
        ) : (
          <>
            <h1 style={styles.title}>{t('forgotPassword.title')}</h1>
            <p style={styles.subtitle}>{t('forgotPassword.subtitle')}</p>

            <div style={styles.field}>
              <label style={styles.label}>{t('login.emailLabel')}</label>
              <input
                type="email"
                placeholder={t('login.emailPlaceholder')}
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={styles.input}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            <button style={styles.btn} onClick={handleSubmit} disabled={loading || !email}>
              {loading ? t('forgotPassword.sending') : t('forgotPassword.submit')}
            </button>

            <p style={styles.registerLink}>
              <a href="/login" style={styles.link}>{t('forgotPassword.backToLogin')}</a>
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
