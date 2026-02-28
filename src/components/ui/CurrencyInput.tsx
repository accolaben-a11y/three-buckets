'use client'
import { useState, useEffect } from 'react'

interface Props {
  value: number // cents
  onChange: (cents: number) => void
  label?: string
  helperText?: string
  className?: string
  disabled?: boolean
  min?: number
  placeholder?: string
}

export default function CurrencyInput({ value, onChange, label, helperText, className = '', disabled, min = 0, placeholder }: Props) {
  const [display, setDisplay] = useState(() => (value / 100).toFixed(0))

  useEffect(() => {
    setDisplay((value / 100).toFixed(0))
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setDisplay(raw)
    const dollars = parseFloat(raw) || 0
    onChange(Math.round(dollars * 100))
  }

  function handleBlur() {
    const dollars = parseFloat(display) || 0
    const clamped = Math.max(min / 100, dollars)
    setDisplay(clamped.toFixed(0))
    onChange(Math.round(clamped * 100))
  }

  return (
    <div className={`relative ${className}`}>
      {label && <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>}
      {helperText && <p className="text-xs text-slate-500 mb-1">{helperText}</p>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
        <input
          type="text"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder ?? '0'}
          className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
        />
      </div>
    </div>
  )
}
