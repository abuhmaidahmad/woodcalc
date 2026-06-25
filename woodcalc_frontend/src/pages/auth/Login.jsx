import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, saveSession } from '../../api/auth';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    const res = await loginUser(email, password);
    setLoading(false);
    if (res.access) {
      saveSession({ access: res.access, refresh: res.refresh }, res.user || {});
      navigate('/dashboard');
    } else {
      setError('Invalid email or password.');
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoMark}>W</div>
        <h1 style={styles.title}>Sign in to WoodCalc</h1>
        <p style={styles.subtitle}>Jordan's cabinet configurator platform</p>

        <div style={styles.field}>
          <label style={styles.label}>Email address</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={styles.input}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Password</label>
          <input
            type="password"
            placeholder="Your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={styles.input}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.btn} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p style={styles.registerLink}>
          Don't have an account?{' '}
          <a href="/register" style={styles.link}>Create one</a>
        </p>
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
  logoMark: {
    width: 48,
    height: 48,
    background: '#C8902A',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 800,
    color: '#fff',
    margin: '0 auto 20px',
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
