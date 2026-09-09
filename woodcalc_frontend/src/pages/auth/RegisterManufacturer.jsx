import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RegisterLayout from '../../components/auth/RegisterLayout';
import FormField, { Input } from '../../components/auth/FormField';
import { registerManufacturer, saveSession } from '../../api/auth';
import { useTranslation } from '../../i18n/LanguageContext';

export default function RegisterManufacturer() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', password: '', phone: '', city: '',
    factory_company_name: '', commercial_registration_number: '',
    production_capacity: '', governorate_region: '',
  });
  const [docFile, setDocFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    setLoading(true);
    setApiError('');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (docFile) fd.append('trade_license_document', docFile);
    const res = await registerManufacturer(fd);
    setLoading(false);
    if (res.tokens) {
      saveSession(res.tokens, { ...res.user, company: res.company });
      navigate('/dashboard');
    } else {
      setErrors(res);
      setApiError(res.detail || t('registerManufacturer.genericError'));
    }
  };

  return (
    <RegisterLayout role="manufacturer" icon="🏭">
      <div style={styles.row}>
        <FormField label={t('registerManufacturer.firstName')} error={errors.first_name?.[0]}>
          <Input placeholder={t('registerManufacturer.firstNamePlaceholder')} value={form.first_name} onChange={set('first_name')} />
        </FormField>
        <FormField label={t('registerManufacturer.lastName')} error={errors.last_name?.[0]}>
          <Input placeholder={t('registerManufacturer.lastNamePlaceholder')} value={form.last_name} onChange={set('last_name')} />
        </FormField>
      </div>
      <FormField label={t('registerManufacturer.email')} error={errors.email?.[0]}>
        <Input type="email" placeholder={t('registerManufacturer.emailPlaceholder')} value={form.email} onChange={set('email')} />
      </FormField>
      <FormField label={t('registerManufacturer.password')} error={errors.password?.[0]}>
        <Input type="password" placeholder={t('registerManufacturer.passwordPlaceholder')} value={form.password} onChange={set('password')} />
      </FormField>
      <div style={styles.row}>
        <FormField label={t('registerManufacturer.phone')} error={errors.phone?.[0]}>
          <Input placeholder={t('registerManufacturer.phonePlaceholder')} value={form.phone} onChange={set('phone')} />
        </FormField>
        <FormField label={t('registerManufacturer.city')} error={errors.city?.[0]}>
          <Input placeholder={t('registerManufacturer.cityPlaceholder')} value={form.city} onChange={set('city')} />
        </FormField>
      </div>
      <FormField label={t('registerManufacturer.companyName')} error={errors.factory_company_name?.[0]}>
        <Input placeholder={t('registerManufacturer.companyNamePlaceholder')} value={form.factory_company_name} onChange={set('factory_company_name')} />
      </FormField>
      <div style={styles.row}>
        <FormField label={t('registerManufacturer.crNumber')} error={errors.commercial_registration_number?.[0]}>
          <Input placeholder={t('registerManufacturer.crPlaceholder')} value={form.commercial_registration_number} onChange={set('commercial_registration_number')} />
        </FormField>
        <FormField label={t('registerManufacturer.region')} error={errors.governorate_region?.[0]}>
          <Input placeholder={t('registerManufacturer.regionPlaceholder')} value={form.governorate_region} onChange={set('governorate_region')} />
        </FormField>
      </div>
      <FormField label={t('registerManufacturer.capacity')} hint={t('registerManufacturer.capacityHint')} error={errors.production_capacity?.[0]}>
        <Input placeholder={t('registerManufacturer.capacityPlaceholder')} value={form.production_capacity} onChange={set('production_capacity')} />
      </FormField>
      <FormField label={t('registerManufacturer.document')} hint={t('registerManufacturer.documentHint')}>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={e => setDocFile(e.target.files[0])}
          style={styles.fileInput}
        />
        {docFile && <span style={styles.fileName}>✓ {docFile.name}</span>}
      </FormField>
      {apiError && <p style={styles.apiError}>{apiError}</p>}
      <button style={styles.btn} onClick={handleSubmit} disabled={loading}>
        {loading ? t('registerManufacturer.submitting') : t('registerManufacturer.submit')}
      </button>
      <p style={styles.loginLink}>
        {t('registerManufacturer.haveAccount')} <a href="/login" style={styles.link}>{t('registerManufacturer.signIn')}</a>
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
  fileInput: { width: '100%', fontSize: 13, color: '#444', cursor: 'pointer' },
  fileName: { display: 'block', fontSize: 12, color: '#2A8C4A', marginTop: 4 },
};
