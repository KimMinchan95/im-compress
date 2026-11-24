import type { ReactNode } from 'react'

interface IconProps {
  className?: string
}

function Icon({ className = 'h-5 w-5', children }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  )
}

export function SunIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" strokeLinecap="round" />
    </Icon>
  )
}

export function MoonIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M16 3.5A8 8 0 1 0 20.5 13 6.5 6.5 0 0 1 16 3.5Z" strokeLinejoin="round" />
    </Icon>
  )
}

export function ExpandIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

export function ExitIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M10 7 5 12l5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 12h9" strokeLinecap="round" />
      <path d="M19 5v14" strokeLinecap="round" />
    </Icon>
  )
}

export function MailIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function GitHubIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1.01.07 1.54 1.06 1.54 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05a9.4 9.4 0 0 1 5.02 0c1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.81 0 .27.18.6.69.49A10.04 10.04 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
    </svg>
  )
}

export function ReplaceIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="3.5" y="6" width="12" height="12" rx="2" />
      <circle cx="7.4" cy="9.4" r="0.9" fill="currentColor" stroke="none" />
      <path d="m7.2 14.2 2-2a.7.7 0 0 1 1 0l2.2 2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 8.5h4.5M18.2 6.2 20.5 8.5 18.2 10.8" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </Icon>
  )
}
