import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RegisterLayout from '../../components/auth/RegisterLayout';
import FormField, { Input } from '../../components/auth/FormField';
import { registerSupplier, saveSession } from '../../api/auth';
import { useTranslation } from '../../i18n/LanguageContext';

const MATERIAL_OPTIONS = [
  { key: 'plywood', labelKey: 'registerSupplier.matPlywood' },
  { key: 'particleboard', labelKey: 'registerSupplier.matParticleboard' },
  { key: 'mdf', labelKey: 'registerSupplier.matMdf' },
  { key: 'hdf', labelKey: 'registerSupplier.matHdf' },
  { key: 'edge_banding', labelKey: 'registerSupplier.matEdgeBanding' },
  { key: 'hinges', labelKey: 'registerSupplier.matHinges' },
  { key: 'drawer_systems', labelKey: 'registerSupplier.matDrawerSystems' },
  { key: 'handles', labelKey: 'registerSupplier.matHandles' },
  { key: 'legs', labelKey: 'registerSupplier.matLegs' },
  { key: 'confirmat_screws', labelKey: 'registerSupplier.matConfirmatScrews' },
  { key: 'shelf_pins', labelKey: 'registerSupplier.matShelfPins' },
  { key: 'gola_profiles', labelKey: 'registerSupplier.matGolaProfiles' },
  { key: 'paint_lacquer', labelKey: 'registerSupplier.matPaintLacquer' },
];

export default function RegisterSupplier() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', password: '', phone: '', city: '',
    company_name: '', commercial_registration_number: '', delivery_coverage_area: '',
  });
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [docFile, setDocFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const toggleMaterial = (key) => {
    setSelectedMaterials(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    setApiError('');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append('materials_supplied', selectedMaterials.join(','));
    if (docFile) fd.append('trade_license_document', docFile);
    const res = await registerSupplier(fd);
    setLoading(false);
    if (res.tokens) {
      saveSession(res.tokens, res.user);
      navigate('/dashboard');
    } else {
      setErrors(res);
      setApiError(res.detail || t('registerSupplier.genericError'));
    }
  };

  return (
    <RegisterLayout role="supplier" icon="📦">
      <div style={styles.row}>
        <FormField label={t('registerSupplier.firstName')} error={errors.first_name?.[0]}>
          <Input placeholder={t('registerSupplier.firstNamePlaceholder')} value={form.first_name} onChange={set('first_name')} />
        </FormField>
        <FormField label={t('registerSupplier.lastName')} error={errors.last_name?.[0]}>
          <Input placeholder={t('registerSupplier.lastNamePlaceholder')} value={form.last_name} onChange={set('last_name')} />
        </FormField>
      </div>
      <FormField label={t('registerSupplier.email')} error={errors.email?.[0]}>
        <Input type="email" placeholder={t('registerSupplier.emailPlaceholder')} value={form.email} onChange={set('email')} />
      </FormField>
      <FormField label={t('registerSupplier.password')} error={errors.password?.[0]}>
        <Input type="password" placeholder={t('registerSupplier.passwordPlaceholder')} value={form.password} onChange={set('password')} />
      </FormField>
      <div style={styles.row}>
        <FormField label={t('registerSupplier.phone')} error={errors.phone?.[0]}>
          <Input placeholder={t('registerSupplier.phonePlaceholder')} value={form.phone} onChange={set('phone')} />
        </FormField>
        <FormField label={t('registerSupplier.city')} error={errors.city?.[0]}>
          <Input placeholder={t('registerSupplier.cityPlaceholder')} value={form.city} onChange={set('city')} />
        </FormField>
      </div>
      <FormField label={t('registerSupplier.companyName')} error={errors.company_name?.[0]}>
        <Input placeholder={t('registerSupplier.companyNamePlaceholder')} value={form.company_name} onChange={set('company_name')} />
      </FormField>
      <div style={styles.row}>
        <FormField label={t('registerSupplier.crNumber')} error={errors.commercial_registration_number?.[0]}>
          <Input placeholder={t('registerSupplier.crPlaceholder')} value={form.commercial_registration_number} onChange={set('commercial_registration_number')} />
        </FormField>
        <FormField label={t('registerSupplier.deliveryArea')} error={errors.delivery_coverage_area?.[0]}>
          <Input placeholder={t('registerSupplier.deliveryAreaPlaceholder')} value={form.delivery_coverage_area} onChange={set('delivery_coverage_area')} />
        </FormField>
      </div>
      <FormField label={t('registerSupplier.materialsSupplied')} hint={t('registerSupplier.materialsHint')}>
        <div style={styles.chipGrid}>
          {MATERIAL_OPTIONS.map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => toggleMaterial(m.key)}
              style={{
                ...styles.chip,
                background: selectedMaterials.includes(m.key) ? '#C8902A' : '#F7F4F0',
                color: selectedMaterials.includes(m.key) ? '#fff' : '#444',
                borderColor: selectedMaterials.includes(m.key) ? '#C8902A' : '#E0DAD4',
              }}
            >
              {t(m.labelKey)}
            </button>
          ))}
        </div>
      </FormField>
      <FormField label={t('registerSupplier.document')} hint={t('registerSupplier.documentHint')}>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={e => setDocFile(e.target.files[0])}
          style={styles.fileInput}
        />
        {docFile && <span style={styles.fileName}>{t('registerSupplier.documentSelected', { name: docFile.name })}</span>}
      </FormField>
      {apiError && <p style={styles.apiError}>{apiError}</p>}
      <button style={styles.btn} onClick={handleSubmit} disabled={loading}>
        {loading ? t('registerSupplier.submitting') : t('registerSupplier.submit')}
      </button>
      <p style={styles.loginLink}>
        {t('registerSupplier.haveAccount')} <a href="/login" style={styles.link}>{t('registerSupplier.signIn')}</a>
      </p>
    </RegisterLayout>
  );
}

const styles = {
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  chipGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    padding: '6px 12px', borderRadius: 20, border: '1.5px solid',
    fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
  },
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
