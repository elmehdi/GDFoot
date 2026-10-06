export const playerSkills = [
  { key: 'attack', label: 'Attack' },
  { key: 'defense', label: 'Defense' },
  { key: 'shooting', label: 'Shooting' },
  { key: 'passing', label: 'Passing' },
  { key: 'dribbling', label: 'Dribbling' },
  { key: 'pace', label: 'Pace' },
] as const

export type SkillKey = typeof playerSkills[number]['key']
export type SkillRatings = Record<SkillKey, number | null>
export type SkillLabels = Record<SkillKey, string>
const skillLabels: Record<SkillKey, readonly [string, string, string, string, string]> = {
  attack: ['Parking it', 'A bit shy', 'Troublemaker', 'Nightmare', 'Main character'],
  defense: ['Open door', 'Late tackle', 'Gets stuck in', 'Brick wall', 'No way through'],
  shooting: ['Row Z', 'Post magnet', 'Clean strike', 'Top bins', 'Ballon d’Or'],
  passing: ['GPS off', 'Hospital ball', 'Threading it', 'Laser vision', 'Remote control'],
  dribbling: ['Heavy touch', 'One trick', 'Twinkle toes', 'Ankles gone', 'Street legend'],
  pace: ['Sunday jog', 'Warming up', 'Quick feet', 'Turbo mode', 'Gone'],
}
export const skillLabel = (skill: SkillKey, value: number | null) => value === null ? 'Not rated' : skillLabels[skill][Math.min(4, Math.floor((value - 1) / 2))]
export const emptySkills = (): SkillRatings => ({ attack: null, defense: null, shooting: null, passing: null, dribbling: null, pace: null })
export const sameSkills = (a: SkillRatings, b: SkillRatings) => playerSkills.every(({ key }) => a[key] === b[key])
