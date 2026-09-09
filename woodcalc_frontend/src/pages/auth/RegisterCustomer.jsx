import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RegisterLayout from '../../components/auth/RegisterLayout';
import FormField, { Input } from '../../components/auth/FormField';
import { registerCustomer, saveSession } from '../../api/auth';
import { useTranslation } from '../../i18n/LanguageContext';

export default function RegisterCustomer() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', password: '', phone: '', city: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    setLoading(true);
    setApiError('');
    const res = await registerCustomer(form);
    setLoading(false);
    if (res.tokens) {
      saveSession(res.tokens, res.user);
      navigate('/dashboard');
    } else {
      setErrors(res);
      setApiError(res.detail || t('registerCustomer.genericError'));
    }
  };

  return (
    <RegisterLayout role="customer" icon="🏠">
      <div style={styles.row}>
        <FormField label={t('registerCustomer.firstName')} error={errors.first_name?.[0]}>
          <Input placeholder={t('registerCustomer.firstNamePlaceholder')} value={form.first_name} onChange={set('first_name')} />
        </FormField>
        <FormField label={t('registerCustomer.lastName')} error={errors.last_name?.[0]}>
          <Input placeholder={t('registerCustomer.lastNamePlaceholder')} value={form.last_name} onChange={set('last_name')} />
        </FormField>
      </div>
      <FormField label={t('registerCustomer.email')} error={errors.email?.[0]}>
        <Input type="email" placeholder={t('registerCustomer.emailPlaceholder')} value={form.email} onChange={set('email')} />
      </FormField>
      <FormField label={t('registerCustomer.password')} error={errors.password?.[0]}>
        <Input type="password" placeholder={t('registerCustomer.passwordPlaceholder')} value={form.password} onChange={set('password')} />
      </FormField>
      <div style={styles.row}>
        <FormField label={t('registerCustomer.phone')} error={errors.phone?.[0]}>
          <Input placeholder={t('registerCustomer.phonePlaceholder')} value={form.phone} onChange={set('phone')} />
        </FormField>
        <FormField label={t('registerCustomer.city')} error={errors.city?.[0]}>
          <Input placeholder={t('registerCustomer.cityPlaceholder')} value={form.city} onChange={set('city')} />
        </FormField>
      </div>
      {apiError && <p style={styles.apiError}>{apiError}</p>}
      <button style={styles.btn} onClick={handleSubmit} disabled={loading}>
        {loading ? t('registerCustomer.submitting') : t('registerCustomer.submit')}
      </button>
      <p style={styles.loginLink}>
        {t('registerCustomer.haveAccount')} <a href="/login" style={styles.link}>{t('registerCustomer.signIn')}</a>
      </p>
    </RegisterLayout>
  );
}

const styles = {
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  btn: {
    width: '100%', padding: '13px', background: '#C8902A', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700,
    cursor: 'pointer', marginTop: 8,
  },
  apiError: { color: '#D94040', fontSize: 13, marginBottom: 8 },
  loginLink: { textAlign: 'center', color: '#666', fontSize: 13, marginTop: 16 },
  link: { color: '#C8902A', fontWeight: 600, textDecoration: 'none' },
};

