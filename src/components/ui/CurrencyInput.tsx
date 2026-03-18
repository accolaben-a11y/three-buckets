'use client'
import { useState, useEffect, useRef } from 'react'

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

function formatWithCommas(dollars: number): string {
  return Math.round(dollars).toLocaleString('en-US')
}

export default function CurrencyInput({ value, onChange, label, helperText, className = '', disabled, min = 0, placeholder }: Props) {
  const [display, setDisplay] = useState(() => formatWithCommas(value / 100))
  const focused = useRef(false)

  // Only sync from parent when not focused (avoids mid-type resets)
  useEffect(() => {
    if (!focused.current) {
      setDisplay(formatWithCommas(value / 100))
    }
  }, [value])

  function handleFocus() {
    focused.current = true
    // Strip commas on focus so user can type cleanly
    setDisplay(display.replace(/,/g, ''))
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setDisplay(raw)
    // Do NOT call onChange here — recalculate on blur only
  }

  function handleBlur() {
    focused.current = false
    const raw = display.replace(/,/g, '')
    const dollars = parseFloat(raw) || 0
    const clamped = Math.max(min / 100, dollars)
    setDisplay(formatWithCommas(clamped))
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
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder ?? '0'}
          className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
        />
      </div>
    </div>
  )
}
