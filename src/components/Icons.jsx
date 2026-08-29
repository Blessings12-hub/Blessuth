// Minimal stroke-based icon set used in place of emoji throughout the app.
// Plain inline SVG, no external icon library required.

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function HomeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
    </svg>
  )
}

export function CanvasIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <path d="M12 19c-4 0-7-2.5-7-7a7 7 0 0 1 14 0c0 1.7-1.3 2.5-2.7 2.5H15a1.5 1.5 0 0 0-1 2.6c.5.5.5 1.9-2 1.9Z" />
      <circle cx="8" cy="10.5" r="1" />
      <circle cx="11.5" cy="7.5" r="1" />
      <circle cx="15.5" cy="9.5" r="1" />
    </svg>
  )
}

export function PhotoIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M20.5 16.5 15 11l-9 8" />
    </svg>
  )
}

export function QuizIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <path d="M9 9a3 3 0 1 1 4 2.8c-.8.3-1.4 1-1.4 1.9v.4" />
      <circle cx="12" cy="17.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

export function MapPinIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <path d="M12 21s7-6.6 7-11.5A7 7 0 0 0 5 9.5C5 14.4 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </svg>
  )
}

export function HeadphonesIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="14" width="4" height="6" rx="1.5" />
      <rect x="17" y="14" width="4" height="6" rx="1.5" />
    </svg>
  )
}

export function MailIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  )
}

export function SettingsIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.6V4a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.6 1H20a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1.5Z" />
    </svg>
  )
}

export function LogoutIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <path d="M15 4.5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8" />
      <path d="M10.5 12H21m0 0-3.5-3.5M21 12l-3.5 3.5" />
    </svg>
  )
}

export function ClockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}

export function HeartIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <path d="M12 20s-7.5-4.7-9.8-9.4C.7 7.1 2.2 4 5.5 4c1.9 0 3.3 1 4.5 2.6C11.2 5 12.6 4 14.5 4c3.3 0 4.8 3.1 3.3 6.6C15.5 15.3 12 20 12 20Z" />
    </svg>
  )
}

export function CakeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <path d="M4 21v-6.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2V21" />
      <path d="M4 21h16" />
      <path d="M8 12.5V9M12 12.5V9M16 12.5V9" />
      <path d="M8 6.5c0-1 .8-1.3.8-2.3S8 2 8 2M12 6.5c0-1 .8-1.3.8-2.3S12 2 12 2M16 6.5c0-1 .8-1.3.8-2.3S16 2 16 2" />
    </svg>
  )
}

export function MessageIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H9l-4.5 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" />
    </svg>
  )
}

export function PlayIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} fill="currentColor" stroke="none" className={props.className}>
      <path d="M7 4.5v15l13-7.5Z" />
    </svg>
  )
}

export function PauseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} fill="currentColor" stroke="none" className={props.className}>
      <rect x="6" y="4.5" width="4" height="15" rx="1" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" />
    </svg>
  )
}

export function LockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </svg>
  )
}

export function UserIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20c1.2-3.8 4.2-6 7.5-6s6.3 2.2 7.5 6" />
    </svg>
  )
}

export function GiftIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <rect x="3.5" y="9" width="17" height="11" rx="1.5" />
      <path d="M3.5 13h17" />
      <path d="M12 9v11" />
      <path d="M12 9c-1.6 0-4-.9-4-3a2 2 0 0 1 4 0c0-1.4 1-2 2-2a2 2 0 0 1 0 4c-.6.6-1.4 1-2 1Z" />
      <path d="M12 9c1.6 0 4-.9 4-3a2 2 0 0 0-4 0" />
    </svg>
  )
}

export function BookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <path d="M4 5.5c2-1 4.5-1 7 0v13c-2.5-1-5-1-7 0Z" />
      <path d="M20 5.5c-2-1-4.5-1-7 0v13c2.5-1 5-1 7 0Z" />
    </svg>
  )
}

export function CalendarIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} {...base} className={props.className}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
    </svg>
  )
}
