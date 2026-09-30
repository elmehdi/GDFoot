const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base', xl: 'w-16 h-16 text-xl' }
const colors = ['#c2d9a8', '#b9cce5', '#e4c1a7', '#d0c0e4', '#a9d3c5']
export default function Avatar({ name, size = 'md' }: { name: string; size?: keyof typeof sizes }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?'
  const hash = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return <span aria-label={name} className={`${sizes[size]} rounded-full shrink-0 inline-flex items-center justify-center font-bold`} style={{ background: colors[hash % colors.length], color: '#19251c' }}>{initials}</span>
}
