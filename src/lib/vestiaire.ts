export const predictionQuestions = [
  { key: 'over_wall', darija: 'Ghadi ytayer koura berra tirane ?', english: 'Who will send the ball over the wall?' },
  { key: 'late', darija: 'Ghadi yji m3attel ?', english: 'Who will arrive late?' },
  { key: 'first_foul', darija: 'Ghadi ygoul wlh ma kofra lwl ?', english: 'Who will be the first to swear it was not a foul?' },
  { key: 'miss_penalty', darija: 'Ghadi ydaye3 Pilanti ?', english: 'Who will miss a penalty?' },
  { key: 'lost_defender', darija: 'Sf ana anl3b f defense - chwiya katl9ah 7da Lpoto dial lakhrine ?', english: 'Who will promise to defend and end up next to the other goal?' },
  { key: 'empty_goal', darija: 'Ghadi ydaye3 rasso rass chbka khawya ?', english: 'Who will miss an open goal?' },
] as const

export type PredictionKey = typeof predictionQuestions[number]['key']
