// The lookout.fleet.v1 contract (docs/adapter.md): validateFleet returns the problems, [] when valid.
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
const str = v => typeof v === 'string' && v !== ''
const num = v => typeof v === 'number' && Number.isFinite(v)
const pct = v => num(v) && v >= 0 && v <= 100
const time = v => typeof v === 'string' && TIME.test(v) && !Number.isNaN(Date.parse(v))
const oneOf = (...xs) => v => xs.includes(v)
const opt = f => v => v === undefined || f(v)
const orNull = f => v => v === null || f(v)
const count = v => Number.isInteger(v) && v >= 0

const SHAPES = {
  hosts: { id: str, name: str, cpu_pct: pct, mem_pct: pct, disk_pct: pct, load1: num, sampled_at: time,
    gate: opt(v => v && oneOf('open', 'closed')(v.state) && pct(v.limit_pct)),
    jobs: opt(v => Array.isArray(v) && v.every(j => j && str(j.kind) && count(j.running) && opt(count)(j.limit))) },
  homes: { id: str, name: str, host: str, lane_cap: v => Number.isInteger(v) && v >= 1,
    supervision: v => v && oneOf('ok', 'stale', 'down')(v.state) && time(v.last_beat_at) && opt(str)(v.note) },
  lanes: { id: str, home: str, title: str, project: str, stage: oneOf('queued', 'working', 'review', 'merging', 'done'),
    stuck: v => typeof v === 'boolean', started_at: time, updated_at: time, pr_url: opt(str), waiting_on: opt(str) },
  workers: { id: str, lane: str, agent: str, model: str, account: str, state: oneOf('working', 'idle', 'waiting', 'exited'),
    started_at: time, last_activity_at: time },
  quota: { account: str, provider: str, window: str, used_pct: pct, resets_at: time, runway_hours: orNull(num) },
  merges: { at: time, repo: str, title: str, outcome: oneOf('merged', 'failed', 'reverted'), checks: oneOf('pass', 'fail'),
    lane: opt(str), pr_url: opt(str), started_at: opt(time), home: opt(str), rework: opt(count) },
  releases: { repo: str, version: str, at: time, channel: str, status: oneOf('shipped', 'pending', 'failed'), url: opt(str), source: opt(str) },
  plans: { repo: str, version: str, home: opt(str), target: opt(time),
    items: v => Array.isArray(v) && v.every(i => i && str(i.title) && typeof i.done === 'boolean') },
  incidents: { id: str, at: time, severity: oneOf('info', 'warn', 'crit'), summary: str, home: opt(str), lane: opt(str),
    resolved_at: opt(time), kind: opt(str) },
  history: { at: time, lanes: count, stuck: count },
  devices: { id: str, name: str, kind: str, host: str, state: oneOf('free', 'busy', 'offline'), lane: opt(str) },
}
// Lists an adapter may leave out; the screens that need them say so.
const OPTIONAL = ['history', 'devices', 'plans']
const IDS = ['hosts', 'homes', 'lanes', 'workers', 'incidents', 'devices']
// [list, field, list it must point into]
const REFS = [['homes', 'host', 'hosts'], ['lanes', 'home', 'homes'], ['workers', 'lane', 'lanes'], ['merges', 'lane', 'lanes'], ['merges', 'home', 'homes'],
  ['incidents', 'home', 'homes'], ['incidents', 'lane', 'lanes'],
  ['devices', 'host', 'hosts'], ['devices', 'lane', 'lanes'], ['plans', 'home', 'homes']]

export function validateFleet(doc) {
  const bad = []
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return ['document: must be a JSON object']
  if (doc.schema !== 'lookout.fleet.v1') bad.push('schema: must be "lookout.fleet.v1"')
  if (!time(doc.generated_at)) bad.push('generated_at: must be an ISO 8601 UTC time')
  if (!str(doc.name)) bad.push('name: must be a non-empty string')
  for (const [list, shape] of Object.entries(SHAPES)) {
    if (doc[list] === undefined && OPTIONAL.includes(list)) continue
    if (!Array.isArray(doc[list])) { bad.push(`${list}: must be a list`); continue }
    doc[list].forEach((row, i) => {
      if (!row || typeof row !== 'object') return bad.push(`${list}[${i}]: must be an object`)
      for (const [field, ok] of Object.entries(shape)) if (!ok(row[field])) bad.push(`${list}[${i}].${field}: invalid`)
    })
  }
  for (const list of IDS) {
    const seen = new Set()
    for (const [i, row] of (Array.isArray(doc[list]) ? doc[list] : []).entries()) {
      if (seen.has(row?.id)) bad.push(`${list}[${i}].id: duplicate "${row.id}"`)
      seen.add(row?.id)
    }
  }
  for (const [list, field, target] of REFS) {
    const ids = new Set((Array.isArray(doc[target]) ? doc[target] : []).map(r => r?.id))
    for (const [i, row] of (Array.isArray(doc[list]) ? doc[list] : []).entries())
      if (row?.[field] !== undefined && !ids.has(row[field])) bad.push(`${list}[${i}].${field}: no ${target} "${row[field]}"`)
  }
  return bad
}
