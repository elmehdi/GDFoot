const badgeSymbols = [
  <path key="lightning" d="M43 10 17 45h20l-4 25 30-39H43Z" fill="currentColor" stroke="#172021" strokeWidth="3" strokeLinejoin="round" />,
  <g key="flame"><path d="M43 9c1 18 22 19 20 40C61 78 17 76 17 48c0-12 8-16 8-24 5 7 10 12 11 12 8-9 9-17 7-27Z" fill="currentColor" stroke="#172021" strokeWidth="3" /><path d="M42 36c1 10 11 15 9 23-2 13-22 10-22-2 0-7 10-10 13-21Z" fill="#fff1b3" /></g>,
  <g key="crown"><path d="m13 23 15 16 12-23 12 23 15-16-7 36H20Z" fill="currentColor" stroke="#172021" strokeWidth="3" strokeLinejoin="round" /><path d="M20 66h40M21 54h38" stroke="#172021" strokeWidth="4" /><circle cx="40" cy="45" r="4" fill="#faf4db" /></g>,
  <g key="comet"><path d="m19 60 44-49-15 33 22-10-26 28Z" fill="currentColor" stroke="#172021" strokeWidth="3" /><circle cx="29" cy="52" r="18" fill="currentColor" stroke="#172021" strokeWidth="3" /><circle cx="26" cy="49" r="7" fill="#fff2c8" /><path d="m10 28 12-12m29 55 9-9" stroke="currentColor" strokeWidth="4" /></g>,
]

/** Inline artwork also travels with the exported lineup image. */
export default function TeamBadge({ team, color, size = 54 }: { team: number; color: string; size?: number }) {
  const symbol = badgeSymbols[(Math.max(1, team) - 1) % badgeSymbols.length]
  return <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ color, flexShrink: 0 }} aria-hidden="true" focusable="false">
    <path d="m50 4 42 21v49L50 97 8 74V25Z" fill="currentColor" />
    <path d="m50 12 34 18v39L50 88 16 69V30Z" fill="#17201e" stroke="#ffffff44" strokeWidth="2" />
    <svg x="15" y="15" width="70" height="70" viewBox="0 0 80 80">{symbol}</svg>
    <path d="M7 75 92 24" stroke="currentColor" strokeWidth="3" opacity=".35" />
  </svg>
}
