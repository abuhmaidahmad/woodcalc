import React from 'react'
import { label, input } from './ui'

export default function NumField({ title, value, onChange, placeholder, min = 0, max, step = 1, disabled }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={label}>{title}</span>
      <input type="number" min={min} max={max} step={step} style={{ ...input, background: disabled ? '#f5f2ed' : '#fff' }} value={value ?? ''} placeholder={placeholder}
        disabled={disabled} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
    </label>
  )
}
