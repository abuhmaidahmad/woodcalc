import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RegisterLayout from '../../components/auth/RegisterLayout';
import FormField, { Input, Select } from '../../components/auth/FormField';
import { registerArchitect, saveSession } from '../../api/auth';

export default function RegisterArchitect() {
  const navigate = useNavigate();
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
      setApiError(res.detail || 'Registration failed.');
    }
  };

  return (
    <RegisterLayout role="architect" icon="📐">
      <div style={styles.row}>
        <FormField label="First name" error={errors.first_name?.[0]}>
          <Input placeholder="Sara" value={form.first_name} onChange={set('first_name')} />
        </FormField>
        <FormField label="Last name" error={errors.last_name?.[0]}>
          <Input placeholder="Khalil" value={form.last_name} onChange={set('last_name')} />
        </FormField>
      </div>
      <FormField label="Email address" error={errors.email?.[0]}>
        <Input type="email" placeholder="you@studio.com" value={form.email} onChange={set('email')} />
      </FormField>
      <FormField label="Password" error={errors.password?.[0]}>
        <Input type="password" placeholder="Minimum 8 characters" value={form.password} onChange={set('password')} />
      </FormField>
      <div style={styles.row}>
        <FormField label="Phone" error={errors.phone?.[0]}>
          <Input placeholder="+962 7..." value={form.phone} onChange={set('phone')} />
        </FormField>
        <FormField label="City" error={errors.city?.[0]}>
          <Input placeholder="Amman" value={form.city} onChange={set('city')} />
        </FormField>
      </div>
      <FormField label="Company / Studio name" error={errors.company_studio_name?.[0]}>
        <Input placeholder="Khalil Design Studio" value={form.company_studio_name} onChange={set('company_studio_name')} />
      </FormField>
      <div style={styles.row}>
        <FormField label="License number" error={errors.license_number?.[0]}>
          <Input placeholder="JEA-12345" value={form.license_number} onChange={set('license_number')} />
        </FormField>
        <FormField label="Years of experience" error={errors.years_of_experience?.[0]}>
          <Input type="number" min="0" placeholder="5" value={form.years_of_experience} onChange={set('years_of_experience')} />
        </FormField>
      </div>
      <FormField label="Portfolio URL" error={errors.portfolio_url?.[0]}>
        <Input type="url" placeholder="https://yourportfolio.com" value={form.portfolio_url} onChange={set('portfolio_url')} />
      </FormField>
      <FormField label="Specialization" error={errors.specialization?.[0]}>
        <Select value={form.specialization} onChange={set('specialization')}>
          <option value="residential">Residential</option>
          <option value="commercial">Commercial</option>
          <option value="both">Both</option>
        </Select>
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
};
