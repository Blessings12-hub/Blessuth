export default function Logo({ size = 40, withWordmark = false, stacked = false }) {
  return (
    <span
      className={'logo-lockup' + (stacked ? ' stacked' : '')}
      style={{ display: 'inline-flex', alignItems: 'center', gap: stacked ? 8 : 10 }}
    >
      <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="Blessuth">
        <rect x="2" y="2" width="60" height="60" rx="16" fill="#232946" />
        <ellipse
          cx="32"
          cy="33"
          rx="24"
          ry="11"
          fill="none"
          stroke="#f4a259"
          strokeWidth="1.6"
          strokeDasharray="3 4"
          opacity="0.55"
          transform="rotate(-8 32 33)"
        />
        <circle cx="10" cy="29" r="2.6" fill="#f4a259" />
        <circle cx="54" cy="37" r="2.6" fill="#ef6f6c" />
        <g transform="translate(15 14) scale(1.45)">
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill="url(#heartGrad)"
          />
        </g>
        <defs>
          <linearGradient id="heartGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ef6f6c" />
            <stop offset="100%" stopColor="#f4a259" />
          </linearGradient>
        </defs>
      </svg>
      {withWordmark && <span className="logo-wordmark">Blessuth</span>}
    </span>
  )
}
