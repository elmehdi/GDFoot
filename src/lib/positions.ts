import type { PlayerPosition } from './database.types'

export const positionLabels: Record<PlayerPosition, string> = {
  any: 'Flexible',
  goalkeeper: 'Goalkeeper',
  defender: 'Defender',
  midfielder: 'Midfielder',
  attacker: 'Attacker',
}
