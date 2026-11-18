import { useEffect, useRef, useState } from 'react'

interface NumberFieldProps {
  label: string
  value: number
  suffix?: string
  allowDecimal?: boolean
  decimals?: number
  live?: boolean
  onChange: (value: number) => void
}

function formatField(value: number, places: number) {
  if (places <= 0) return String(Math.round(value))
  const factor = 10 ** places
  const rounded = Math.round(value * factor) / factor
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(places).replace(/\.?0+$/, '')
}

function parseField(text: string, places: number) {
  const pattern = places > 0 ? new RegExp(`^\\d+(\\.\\d{1,${places}})?$`) : /^\d+$/
  if (!pattern.test(text)) return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

export function NumberField({
  label,
  value,
  suffix,
  allowDecimal = false,
  decimals,
  live = true,
  onChange,
}: NumberFieldProps) {
  const places = decimals ?? (allowDecimal ? 1 : 0)
  const [text, setText] = useState(() => formatField(value, places))
  const [blurCount, setBlurCount] = useState(0)
  const isFocused = useRef(false)

  useEffect(() => {
    if (isFocused.current) return
    setText(formatField(value, places))
  }, [blurCount, places, value])

  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="text-sm font-medium text-muted">{label}</span>
      <span className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-panel px-3 transition duration-200 focus-within:border-accent/70">
        <input
          value={text}
          inputMode={places > 0 ? 'decimal' : 'numeric'}
          spellCheck={false}
          aria-label={label}
          className="w-full bg-transparent text-base font-medium tabular-nums outline-none"
          onFocus={(event) => {
            isFocused.current = true
            event.currentTarget.select()
          }}
          onBlur={(event) => {
            isFocused.current = false
            const next = parseField(event.currentTarget.value, places)
            if (next !== null) onChange(next)
            setBlurCount((count) => count + 1)
          }}
          onChange={(event) => {
            const nextText = event.target.value
            const partial = places > 0 ? new RegExp(`^\\d*\\.?\\d{0,${places}}$`) : /^\d*$/
            if (!partial.test(nextText)) return
            setText(nextText)
            if (!live) return
            const next = parseField(nextText, places)
            if (next !== null) onChange(next)
          }}
        />
        {suffix ? <span className="shrink-0 text-sm text-muted">{suffix}</span> : null}
      </span>
    </label>
  )
}
