import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RegisterLayout from '../../components/auth/RegisterLayout';
import FormField, { Input, Select } from '../../components/auth/FormField';
import { registerArchitect, saveSession } from '../../api/auth';
import { useTranslation } from '../../i18n/LanguageContext';

export default function RegisterArchitect() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', password: '', phone: '', city: '',
    company_studio_name: '', license_number: '', portfolio_url: '',
    specialization: 'both', years_of_experience: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    setLoading(true);
    setApiError('');
    const res = await registerArchitect({
      ...form,
      years_of_experience: Number(form.years_of_experience) || 0,
    });
    setLoading(false);
    if (res.tokens) {
      saveSession(res.tokens, res.user);
      navigate('/dashboard');
    } else {
      setErrors(res);
      setApiError(res.detail || t('registerArchitect.genericError'));
    }
  };

  return (
    <RegisterLayout role="architect" icon="📐">
      <div style={styles.row}>
        <FormField label={t('registerArchitect.firstName')} error={errors.first_name?.[0]}>
          <Input placeholder={t('registerArchitect.firstNamePlaceholder')} value={form.first_name} onChange={set('first_name')} />
        </FormField>
        <FormField label={t('registerArchitect.lastName')} error={errors.last_name?.[0]}>
          <Input placeholder={t('registerArchitect.lastNamePlaceholder')} value={form.last_name} onChange={set('last_name')} />
        </FormField>
      </div>
      <FormField label={t('registerArchitect.email')} error={errors.email?.[0]}>
        <Input type="email" placeholder={t('registerArchitect.emailPlaceholder')} value={form.email} onChange={set('email')} />
      </FormField>
      <FormField label={t('registerArchitect.password')} error={errors.password?.[0]}>
        <Input type="password" placeholder={t('registerArchitect.passwordPlaceholder')} value={form.password} onChange={set('password')} />
      </FormField>
      <div style={styles.row}>
        <FormField label={t('registerArchitect.phone')} error={errors.phone?.[0]}>
          <Input placeholder={t('registerArchitect.phonePlaceholder')} value={form.phone} onChange={set('phone')} />
        </FormField>
        <FormField label={t('registerArchitect.city')} error={errors.city?.[0]}>
          <Input placeholder={t('registerArchitect.cityPlaceholder')} value={form.city} onChange={set('city')} />
        </FormField>
      </div>
      <FormField label={t('registerArchitect.companyStudioName')} error={errors.company_studio_name?.[0]}>
        <Input placeholder={t('registerArchitect.companyStudioPlaceholder')} value={form.company_studio_name} onChange={set('company_studio_name')} />
      </FormField>
      <div style={styles.row}>
        <FormField label={t('registerArchitect.licenseNumber')} error={errors.license_number?.[0]}>
          <Input placeholder={t('registerArchitect.licenseNumberPlaceholder')} value={form.license_number} onChange={set('license_number')} />
        </FormField>
        <FormField label={t('registerArchitect.yearsExperience')} error={errors.years_of_experience?.[0]}>
          <Input type="number" min="0" placeholder={t('registerArchitect.yearsExperiencePlaceholder')} value={form.years_of_experience} onChange={set('years_of_experience')} />
        </FormField>
      </div>
      <FormField label={t('registerArchitect.portfolioUrl')} error={errors.portfolio_url?.[0]}>
        <Input type="url" placeholder={t('registerArchitect.portfolioUrlPlaceholder')} value={form.portfolio_url} onChange={set('portfolio_url')} />
      </FormField>
      <FormField label={t('registerArchitect.specialization')} error={errors.specialization?.[0]}>
        <Select value={form.specialization} onChange={set('specialization')}>
          <option value="residential">{t('registerArchitect.specResidential')}</option>
          <option value="commercial">{t('registerArchitect.specCommercial')}</option>
          <option value="both">{t('registerArchitect.specBoth')}</option>
        </Select>
      </FormField>
      {apiError && <p style={styles.apiError}>{apiError}</p>}
      <button style={styles.btn} onClick={handleSubmit} disabled={loading}>
        {loading ? t('registerArchitect.submitting') : t('registerArchitect.submit')}
      </button>
      <p style={styles.loginLink}>
        {t('registerArchitect.haveAccount')} <a href="/login" style={styles.link}>{t('registerArchitect.signIn')}</a>
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
