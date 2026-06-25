import React from 'react';

export default function FormField({ label, error, children, hint }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={styles.label}>{label}</label>
      {hint && <span style={styles.hint}>{hint}</span>}
      {children}
      {error && <span style={styles.error}>{error}</span>}
    </div>
  );
}

export function Input({ style, ...props }) {
  return <input style={{ ...styles.input, ...style }} {...props} />;
}

export function Select({ children, style, ...props }) {
  return (
    <select style={{ ...styles.input, ...style }} {...props}>
      {children}
    </select>
  );
}

const styles = {
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#333',
    marginBottom: 6,
  },
  hint: {
    display: 'block',
    fontSize: 12,
    color: '#999',
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
    transition: 'border-color 0.15s',
  },
  error: {
    display: 'block',
    color: '#D94040',
    fontSize: 12,
    marginTop: 4,
  },
};
