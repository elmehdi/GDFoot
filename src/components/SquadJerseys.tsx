import { useId } from 'react'
import { useClubDirectory } from '../context/ClubDirectoryContext'
import { useI18n } from '../context/LanguageContext'

// A fresh draw per page load, stable across polling, re-renders and navigation.
const drawSeed = Math.floor(Math.random() * 0xffffffff)
function drawOrder(id: string) {
  let hash = drawSeed
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x45d9f3b)
  return (hash ^ (hash >>> 16)) >>> 0
}

function Jersey({ name, number, variant }: { name: string; number: string; variant: 'blue' | 'lime' }) {
  const id = useId().replace(/:/g, '')
  const blue = variant === 'blue'
  const ink = blue ? '#f1f5ff' : '#243b27'
  const shape = 'M80 20 Q120 38 160 20 L205 39 Q211 42 214 50 L235 91 202 112 184 88 188 247 Q155 259 120 259 Q85 259 52 247 L56 88 38 112 5 91 26 50 Q29 42 35 39Z'
  const lettering = name.trim().toLocaleUpperCase().replace(/\s+/g, ' ')
  const words = lettering.split(' ')
  let nameLines = [lettering]
  if (Array.from(lettering).length > 12) {
    if (words.length > 1) {
      // Split at the most balanced word boundary, preserving the full name.
      const splits = words.slice(1).map((_, index) => [words.slice(0, index + 1).join(' '), words.slice(index + 1).join(' ')])
      nameLines = splits.reduce((best, split) => Math.max(...split.map(line => Array.from(line).length)) < Math.max(...best.map(line => Array.from(line).length)) ? split : best)
    } else {
      const letters = Array.from(lettering)
      const middle = Math.ceil(letters.length / 2)
      nameLines = [letters.slice(0, middle).join(''), letters.slice(middle).join('')]
    }
  }
  return <div className={'jersey jersey-' + variant}>
    <svg viewBox="0 0 240 280" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id + '-fabric'} x1="40" y1="25" x2="215" y2="250" gradientUnits="userSpaceOnUse">
          <stop stopColor={blue ? '#799ce3' : '#e5f6aa'} /><stop offset=".45" stopColor={blue ? '#426bb6' : '#c9e77c'} /><stop offset="1" stopColor={blue ? '#284d90' : '#93b949'} />
        </linearGradient>
        <linearGradient id={id + '-fold'} x1="50" y1="0" x2="190" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#000" stopOpacity=".2" /><stop offset=".15" stopColor="#fff" stopOpacity=".1" /><stop offset=".4" stopColor="#fff" stopOpacity="0" /><stop offset=".82" stopColor="#000" stopOpacity=".03" /><stop offset="1" stopColor="#000" stopOpacity=".22" />
        </linearGradient>
        <pattern id={id + '-knit'} width="4" height="4" patternUnits="userSpaceOnUse"><path d="m1 0 1 2-1 2" stroke="#fff" strokeOpacity=".065" strokeWidth=".7" /></pattern>
        <clipPath id={id + '-cut'}><path d={shape} /></clipPath>
      </defs>
      <path d={shape} fill={'url(#' + id + '-fabric)'} stroke={blue ? '#92afe0' : '#e6f4b3'} strokeOpacity=".65" />
      <g clipPath={'url(#' + id + '-cut)'}>
        <path d="m29 42 30 48-7 161 12 6 4-169-29-51Zm182 0-30 48 7 161-12 6-4-169 29-51Z" fill={ink} opacity=".12" />
        <path d="M76 30 58 78M164 30l18 48" stroke={ink} strokeOpacity=".4" strokeWidth="2" />
        <path d="m9 83 33 21m156 0 33-21" stroke={ink} strokeWidth="9" strokeOpacity=".8" />
        <path d="m9 83 33 21m156 0 33-21" stroke={blue ? '#bacdf0' : '#f3f8dc'} strokeWidth="2" strokeOpacity=".7" />
        <path d="M53 240q67 20 134 0" stroke={ink} strokeOpacity=".24" strokeDasharray="2 2" />
        <path d="M73 102q-10 43-7 83m100-76q12 58 6 112M82 227q36-7 76 0" stroke={ink} strokeOpacity=".07" strokeWidth="3" strokeLinecap="round" />
        <path d={shape} fill={'url(#' + id + '-fold)'} />
        <path d={shape} fill={'url(#' + id + '-knit)'} />
      </g>
      <path d="M80 20q40 30 80 0l-5 11q-35 24-70 0Z" fill={blue ? '#223e72' : '#607f32'} />
      <path d="M84 23q36 26 72 0" stroke={ink} strokeWidth="2" strokeOpacity=".6" />
      <rect x="112" y="48" width="16" height="4" rx="2" fill={ink} opacity=".55" />
      <text textAnchor="middle" fill={ink} fontFamily="Outfit, sans-serif" fontSize="15" fontWeight="800" letterSpacing=".6">
        {nameLines.map((line, index) => <tspan key={index} x="120" y={nameLines.length === 1 ? 85 : 75 + index * 18} textLength={Array.from(line).length > 11 ? 116 : undefined} lengthAdjust="spacingAndGlyphs">{line}</tspan>)}
      </text>
      <text x="117" y="192" textAnchor="middle" fill={ink} stroke={ink} strokeOpacity=".22" strokeWidth=".8" fontFamily="Outfit, sans-serif" fontSize="106" fontWeight="800" letterSpacing="-6">{number}</text>
      <path d="M107 211h26" stroke={ink} strokeOpacity=".35" />
      <text x="120" y="225" textAnchor="middle" fill={ink} opacity=".65" fontFamily="Outfit, sans-serif" fontSize="5" fontWeight="600" letterSpacing="2">FOOTBALL CLUB</text>
    </svg>
  </div>
}

export default function SquadJerseys() {
  const { players } = useClubDirectory()
  const { t } = useI18n()
  const picked = [...players].sort((a,b) => drawOrder(a.id) - drawOrder(b.id) || a.id.localeCompare(b.id)).slice(0,2)
  return <div className="jersey-composition" aria-hidden="true">
    <span className="orbit orbit-one" /><span className="orbit orbit-two" />
    <span className="graphic-caption">{t('TWO SIDES.')}<br />{t('ONE GREAT GAME.')}</span>
    <Jersey name={picked[0]?.display_name ?? 'HOME'} number="07" variant="blue" />
    <Jersey name={picked[1]?.display_name ?? 'AWAY'} number="10" variant="lime" />
    <div className="fair-play-stamp">FAIR<br /><b>PLAY</b><span>FOOTBALL CLUB</span></div>
  </div>
}
