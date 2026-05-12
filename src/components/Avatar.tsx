interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
}

export default function Avatar({ name, size = 'md' }: AvatarProps) {
  const avatarUrl = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}`

  return (
    <div className={`${sizeMap[size]} rounded-full flex-shrink-0 bg-slate-800 flex items-center justify-center overflow-hidden ring-1 ring-slate-600/50`}>
      <img
        src={avatarUrl}
        alt={name}
        className="w-[80%] h-[80%]"
      />
    </div>
  )
}
