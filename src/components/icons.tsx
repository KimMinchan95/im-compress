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

export function GithubIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path
        d="M9 19c-4 1.5-4-2.5-6-3m12 5v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.1-1.5 6.1-6.6a5.1 5.1 0 0 0-1.4-3.5 4.7 4.7 0 0 0-.1-3.5s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.1 5.4 2.4 5.4 2.4a4.7 4.7 0 0 0-.1 3.5A5.1 5.1 0 0 0 3.9 9.4c0 5.1 3.1 6.2 6.1 6.6a3.4 3.4 0 0 0-.9 2.6V21"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
