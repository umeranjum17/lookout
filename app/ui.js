// Time words and the lane vocabulary the screens share. Every age is measured against the document's own generated_at.
export { html } from './vendor/preact-htm-3.1.1.js'

export const ago = (from, to) => {
  const s = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000))
  return s < 60 ? 'now' : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m` : `${Math.floor(s / 86400)}d`
}
export const when = (fleet, t) => ago(t, fleet.generated_at)
export const STAGES = [['queued', 'Queued'], ['working', 'Working'], ['review', 'Review'], ['merging', 'Merging'], ['done', 'Done']]
export const open = fleet => fleet.lanes.filter(l => l.stage !== 'done')
export const slotsOf = fleet => fleet.homes.reduce((n, h) => n + h.lane_cap, 0)
export const back = (fleet, t) => { const a = when(fleet, t); return a === 'now' ? 'just now' : `${a} ago` }
// Lanes in board order: by stage, stuck first, longest-waiting first. The lane page's prev and next walk this order.
export const laneOrder = fleet => [...fleet.lanes].sort((a, b) => STAGES.findIndex(s => s[0] === a.stage) - STAGES.findIndex(s => s[0] === b.stage)
  || b.stuck - a.stuck || Date.parse(a.updated_at) - Date.parse(b.updated_at))
