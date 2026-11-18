import { useEffect, useRef, useState } from 'react'

interface NumberFieldProps {
  label: string
  value: number
  suffix?: string
  allowDecimal?: boolean
  onChange: (value: number) => void
}

function formatField(value: number, allowDecimal: boolean) {
  if (!allowDecimal) return String(Math.round(value))
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function parseField(text: string, allowDecimal: boolean) {
  const pattern = allowDecimal ? /^\d+(\.\d)?$/ : /^\d+$/
  if (!pattern.test(text)) return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

export function NumberField({
  label,
  value,
  suffix,
  allowDecimal = false,
  onChange,
}: NumberFieldProps) {
  const [text, setText] = useState(() => formatField(value, allowDecimal))
  const [blurCount, setBlurCount] = useState(0)
  const isFocused = useRef(false)

  useEffect(() => {
    if (isFocused.current) return
    setText(formatField(value, allowDecimal))
  }, [allowDecimal, blurCount, value])

  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="text-[11px] font-medium tracking-[0.14em] text-muted">{label}</span>
      <span className="flex h-10 items-center gap-2 rounded-2xl border border-line bg-sunken px-3 transition focus-within:border-cream/40">
        <input
          value={text}
          inputMode={allowDecimal ? 'decimal' : 'numeric'}
          spellCheck={false}
          aria-label={label}
          className="w-full bg-transparent text-sm font-medium tabular-nums outline-none"
          onFocus={(event) => {
            isFocused.current = true
            event.currentTarget.select()
          }}
          onBlur={() => {
            isFocused.current = false
            const next = parseField(text, allowDecimal)
            if (next !== null) onChange(next)
            setBlurCount((count) => count + 1)
          }}
          onChange={(event) => {
            const nextText = event.target.value
            const partial = allowDecimal ? /^\d*\.?\d{0,1}$/ : /^\d*$/
            if (!partial.test(nextText)) return
            setText(nextText)
            const next = parseField(nextText, allowDecimal)
            if (next !== null) onChange(next)
          }}
        />
        {suffix ? <span className="shrink-0 text-sm text-muted">{suffix}</span> : null}
      </span>
    </label>
  )
}
