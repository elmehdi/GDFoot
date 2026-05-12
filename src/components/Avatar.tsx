interface AvatarProps {
  name: string
  url?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
}

export default function Avatar({ name, url, size = 'md' }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Generate a consistent color from name
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const colors = [
    'from-blue-500 to-indigo-600',
    'from-cyan-500 to-blue-600',
    'from-violet-500 to-purple-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-teal-500 to-emerald-600',
    'from-fuchsia-500 to-pink-600',
    'from-sky-500 to-blue-600',
  ]
  const gradient = colors[hash % colors.length]

  // Use DiceBear API for avatar images
  const avatarUrl = url || `https://api.dicebear.com/8.x/avataaars/svg?seed=${encodeURIComponent(name)}&backgroundColor=transparent`

  return (
    <div className={`${sizeMap[size]} rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white/10`}>
      <img
        src={avatarUrl}
        alt={name}
        className="w-full h-full object-cover"
        onError={(e) => {
          // Fallback to initials
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
          target.parentElement!.innerHTML = `<div class="w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-white">${initials}</div>`
        }}
      />
    </div>
  )
}
