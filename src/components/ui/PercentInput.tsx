'use client'
import { useState, useEffect } from 'react'

interface Props {
  value: number // basis points
  onChange: (bps: number) => void
  label?: string
  className?: string
  step?: number
}

export default function PercentInput({ value, onChange, label, className = '', step = 0.25 }: Props) {
  const [display, setDisplay] = useState(() => (value / 100).toFixed(2))

  useEffect(() => {
    setDisplay((value / 100).toFixed(2))
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDisplay(e.target.value)
    const pct = parseFloat(e.target.value) || 0
    onChange(Math.round(pct * 100))
  }

  function handleBlur() {
    const pct = parseFloat(display) || 0
    setDisplay(pct.toFixed(2))
    onChange(Math.round(pct * 100))
  }

  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>}
      <div className="relative">
        <input
          type="number"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          step={step}
          min={0}
          max={20}
          className="w-full px-3 pr-8 py-2 border border-slate-300 rounded-lg text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
      </div>
    </div>
  )
}
