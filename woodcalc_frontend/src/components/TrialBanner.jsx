import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCompany } from '../api/auth';

function computeBanner(company) {
  if (!company) return null;

  if (company.status === 'suspended' || company.status === 'canceled') {
    return { tone: 'danger', text: 'Your subscription has been suspended. Contact us to restore access.' };
  }
  if (company.status === 'past_due') {
    return { tone: 'danger', text: 'Payment past due — update billing to avoid losing access.' };
  }
  if (company.status === 'trialing') {
    if (!company.trial_ends_at) return null;
    const daysLeft = Math.ceil((new Date(company.trial_ends_at) - new Date()) / 86400000);
    if (daysLeft <= 0) {
      return { tone: 'danger', text: 'Your free trial has expired. Contact us to activate a subscription and keep using WoodCalc.' };
    }
    if (daysLeft <= 3) {
      return { tone: 'warning', text: `Your trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — contact us to activate a paid plan.` };
    }
    return { tone: 'info', text: `Free trial: ${daysLeft} days left.` };
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
  const [banner, setBanner] = useState(() => computeBanner(getCompany()));

  useEffect(() => {
    const onAccessDenied = () => {
      const company = getCompany();
      setBanner(
        computeBanner(company) || {
          tone: 'danger',
          text: 'Access is currently blocked for your company account. Contact us for help.',
        }
      );
    };
    window.addEventListener('woodcalc:access-denied', onAccessDenied);
    return () => window.removeEventListener('woodcalc:access-denied', onAccessDenied);
  }, []);

  if (!banner) return null;

  const tone = TONE_STYLES[banner.tone];
  return (
    <div onClick={() => navigate('/settings')} style={{ ...styles.bar, ...tone }}>
      {banner.text} <span style={styles.link}>Manage billing →</span>
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
