import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RegisterLayout from '../../components/auth/RegisterLayout';
import FormField, { Input } from '../../components/auth/FormField';
import { registerManufacturer, saveSession } from '../../api/auth';

export default function RegisterManufacturer() {
  const navigate = useNavigate();
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
      saveSession(res.tokens, res.user);
      navigate('/dashboard');
    } else {
      setErrors(res);
      setApiError(res.detail || 'Registration failed.');
    }
  };

  return (
    <RegisterLayout role="manufacturer" icon="🏭">
      <div style={styles.row}>
        <FormField label="First name" error={errors.first_name?.[0]}>
          <Input placeholder="Khalid" value={form.first_name} onChange={set('first_name')} />
        </FormField>
        <FormField label="Last name" error={errors.last_name?.[0]}>
          <Input placeholder="Nasser" value={form.last_name} onChange={set('last_name')} />
        </FormField>
      </div>
      <FormField label="Email address" error={errors.email?.[0]}>
        <Input type="email" placeholder="you@factory.com" value={form.email} onChange={set('email')} />
      </FormField>
      <FormField label="Password" error={errors.password?.[0]}>
        <Input type="password" placeholder="Minimum 8 characters" value={form.password} onChange={set('password')} />
      </FormField>
      <div style={styles.row}>
        <FormField label="Phone" error={errors.phone?.[0]}>
          <Input placeholder="+962 7..." value={form.phone} onChange={set('phone')} />
        </FormField>
        <FormField label="City" error={errors.city?.[0]}>
          <Input placeholder="Zarqa" value={form.city} onChange={set('city')} />
        </FormField>
      </div>
      <FormField label="Factory / Company name" error={errors.factory_company_name?.[0]}>
        <Input placeholder="Al-Nasser Woodworks" value={form.factory_company_name} onChange={set('factory_company_name')} />
      </FormField>
      <div style={styles.row}>
        <FormField label="Commercial registration no." error={errors.commercial_registration_number?.[0]}>
          <Input placeholder="CR-123456" value={form.commercial_registration_number} onChange={set('commercial_registration_number')} />
        </FormField>
        <FormField label="Governorate / Region" error={errors.governorate_region?.[0]}>
          <Input placeholder="Zarqa Governorate" value={form.governorate_region} onChange={set('governorate_region')} />
        </FormField>
      </div>
      <FormField label="Production capacity" hint="e.g. 80 cabinets/week" error={errors.production_capacity?.[0]}>
        <Input placeholder="80 cabinets/week" value={form.production_capacity} onChange={set('production_capacity')} />
      </FormField>
      <FormField label="Trade license document" hint="PDF or image — required for full access">
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
        {loading ? 'Creating account…' : 'Create account'}
      </button>
      <p style={styles.loginLink}>
        Already have an account? <a href="/login" style={styles.link}>Sign in</a>
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
