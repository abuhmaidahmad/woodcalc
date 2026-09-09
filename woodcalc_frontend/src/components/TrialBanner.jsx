import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCompany } from '../api/auth';
import { useTranslation } from '../i18n/LanguageContext';

function computeBanner(company, t) {
  if (!company) return null;

  if (company.status === 'suspended' || company.status === 'canceled') {
    return { tone: 'danger', text: t('trialBanner.suspended') };
  }
  if (company.status === 'past_due') {
    return { tone: 'danger', text: t('trialBanner.pastDue') };
  }
  if (company.status === 'trialing') {
    if (!company.trial_ends_at) return null;
    const daysLeft = Math.ceil((new Date(company.trial_ends_at) - new Date()) / 86400000);
    if (daysLeft <= 0) {
      return { tone: 'danger', text: t('trialBanner.expired') };
    }
    if (daysLeft <= 3) {
      return { tone: 'warning', text: t('trialBanner.endingSoon', { days: daysLeft }) };
    }
    return { tone: 'info', text: t('trialBanner.trialLeft', { days: daysLeft }) };
  }
  return null;
}

const TONE_STYLES = {
  info: { background: '#EFE7DA', color: '#7A5A20' },
  warning: { background: '#FCE9C7', color: '#8A5A00' },
  danger: { background: '#FBDCDC', color: '#A32020' },
};

export default function TrialBanner() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const [banner, setBanner] = useState(() => computeBanner(getCompany(), t));

  useEffect(() => {
    const onAccessDenied = () => {
      const company = getCompany();
      setBanner(computeBanner(company, t) || { tone: 'danger', text: t('trialBanner.blocked') });
    };
    window.addEventListener('woodcalc:access-denied', onAccessDenied);
    return () => window.removeEventListener('woodcalc:access-denied', onAccessDenied);
  }, [t]);

  if (!banner) return null;

  const tone = TONE_STYLES[banner.tone];
  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} onClick={() => navigate('/settings')} style={{ ...styles.bar, ...tone }}>
      {banner.text} <span style={styles.link}>{t('trialBanner.manageBilling')} {language === 'ar' ? '←' : '→'}</span>
    </div>
  );
}

const styles = {
  bar: {
    width: '100%',
    padding: '8px 24px',
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'center',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  link: {
    textDecoration: 'underline',
  },
};
