import { html, back, open, slotsOf, pct, hm } from './ui.js'
import { Line, Bars, Spark } from './charts.js'

const HOUR = 3600e3, DAY = 24 * HOUR
const sameDay = (a, b) => a.slice(0, 10) === b.slice(0, 10)
const Meter = ({ pct, label }) => html`<div class="bar" role="img" aria-label=${label}><i style=${{ width: `${Math.min(100, pct)}%` }}></i></div>`
export const RANGES = [['24h', 'Last 24 hours', DAY], ['7d', 'Last 7 days', 7 * DAY]]
export const wday = (t, style = 'short') => new Date(t).toLocaleDateString('en', { weekday: style, timeZone: 'UTC' })

// The last n whole UTC days, today included, as [start, name, axis label]: 7 days label each weekday, longer runs every 7th day.
export const lastDays = (to, n) => Array.from({ length: n }, (_, k) => {
  const d = Math.floor(to / DAY) * DAY - (n - 1 - k) * DAY, today = k === n - 1
  return [d, today ? 'today' : new Date(d).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }),
    today ? 'Today' : n <= 7 ? wday(d) : (n - 1 - k) % 7 ? undefined : new Date(d).toLocaleDateString('en', { day: 'numeric', month: 'short', timeZone: 'UTC' })]
})

// Merges per hour over 24 hours, per UTC day over 7 or 30 days: ok = merged, bad = failed or reverted.
export function mergeBuckets(fleet, range, to) {
  const spans = range === '24h'
    ? Array.from({ length: 24 }, (_, k) => [to - (24 - k) * HOUR, to - (23 - k) * HOUR, k === 23 ? 'the last hour' : `${24 - k} to ${23 - k} hours ago`,
      { 0: '24h ago', 6: '18h', 12: '12h', 18: '6h', 23: 'now' }[k]])
    : lastDays(to, range === '30d' ? 30 : 7).map(([d, label, tick]) => [d, d + DAY, label, tick])
  return spans.map(([a, b, label, tick]) => {
    const ms = fleet.merges.filter(m => Date.parse(m.at) >= a && Date.parse(m.at) < b)
    return { ok: ms.filter(m => m.outcome === 'merged').length, bad: ms.filter(m => m.outcome !== 'merged').length, label, tick }
  })
}

export function Overview({ fleet, range }) {
  const lanes = open(fleet), slots = slotsOf(fleet), [key, name, span] = RANGES.find(([k]) => k === range) || RANGES[0], words = name.toLowerCase()
  const to = Date.parse(fleet.generated_at), from = to - span
  const hist = (fleet.history || []).map(h => ({ ...h, t: Date.parse(h.at) })).filter(h => h.t >= from && h.t <= to).sort((a, b) => a.t - b.t)
  // 7 days of hourly samples read as noise, so that range shows the average of each 4 hours as a step line, over day bands.
  const STEP = 4 * HOUR, hh = t => new Date(t).toISOString().slice(11, 16)
  const groups = Object.entries(hist.reduce((g, h) => { const s = from + Math.min(Math.floor((h.t - from) / STEP), Math.ceil(span / STEP) - 1) * STEP; (g[s] ||= []).push(h.lanes); return g }, {}))
  const points = key === '24h' ? hist.map(h => ({ t: h.t, v: h.lanes, label: back(fleet, h.at) }))
    : groups.map(([s, vs]) => { const t0 = +s, t1 = Math.min(to, t0 + STEP)
      return { t0, t1, t: (t0 + t1) / 2, v: Math.round(vs.reduce((n, v) => n + v, 0) / vs.length * 10) / 10, label: `${wday(t0)} ${hh(t0)} to ${hh(t1)} UTC` } })
  const days = Array.from({ length: 7 }, (_, k) => Math.floor(to / DAY) * DAY - k * DAY).map(d => [Math.max(from, d), Math.min(to, d + DAY)])
  const bands = key === '24h' ? [] : days.filter((_, k) => k % 2 === 0)
  const ticks = key === '24h' ? [24, 18, 12, 6, 0].map(n => ({ t: to - n * HOUR, label: n === 24 ? '24h ago' : n ? `${n}h` : 'now' }))
    : days.map(([a, b]) => ({ t: (a + b) / 2, label: wday(a) }))
  const buckets = mergeBuckets(fleet, key, to), mergedIn = buckets.reduce((n, b) => n + b.ok, 0)
  const stuck = lanes.filter(l => l.stuck).length, peak = Math.max(0, ...hist.map(h => h.stuck))
  // Over 7 days the sparkline shows the worst of each 6 samples, so a week stays readable in a small card.
  const trend = key === '24h' ? hist.map(h => h.stuck) : hist.reduce((a, h, k) => (k % 6 ? a[a.length - 1] = Math.max(a.at(-1), h.stuck) : a.push(h.stuck), a), [])
  const healthy = fleet.homes.filter(h => h.supervision.state === 'ok').length
  const incidents = fleet.incidents.filter(i => !i.resolved_at).length
  const today = fleet.merges.filter(m => m.outcome === 'merged' && m.started_at && sameDay(m.at, fleet.generated_at)).map(m => Date.parse(m.at) - Date.parse(m.started_at)).sort((a, b) => a - b)
  const q = fleet.quota.filter(x => x.runway_hours != null).sort((a, b) => a.runway_hours - b.runway_hours)[0]
  return html`<div class="chips" role="group" aria-label="Time range">${RANGES.map(([k, label]) =>
      html`<a class=${'chip' + (k === key ? ' on' : '')} key=${k} href=${`#/overview?range=${k}`} aria-current=${k === key ? 'true' : null}>${label}</a>`)}</div>
    <div class="g g-a">
      <div class="card slots"><span class="lbl">Lanes in use</span><b class="big">${lanes.length} of ${slots}</b><small>slots · ${Math.max(0, slots - lanes.length)} free</small>
        <${Meter} pct=${slots ? lanes.length / slots * 100 : 0} label=${`${lanes.length} of ${slots} slots in use`}/>
        <div class="homes">${fleet.homes.map(h => {
          const n = lanes.filter(l => l.home === h.id).length
          return html`<a class="hm" key=${h.id} href=${`#/lanes?home=${h.id}`}><span>${h.name}</span><span class="num">${n}/${h.lane_cap}${n > h.lane_cap ? ' · over' : ''} ›</span>
            <${Meter} pct=${n / h.lane_cap * 100} label=${`${h.name}: ${n} of ${h.lane_cap} lanes`}/></a>`
        })}</div></div>
      <div class="card chart"><div class="ch"><b>Lanes in use</b><small>${words}</small></div>
        ${points.length > 1 ? html`<${Line} points=${points} from=${from} to=${to} max=${Math.max(slots, ...points.map(p => p.v))} cap=${slots} ticks=${ticks} bands=${bands}
          label=${`Lanes in use, ${words}: ${points.map(p => p.v).join(', ')}; ${slots} slots`} tip=${p => `${p.v} of ${slots} lanes${p.t0 != null ? ' on average' : ''}`}/>`
          : html`<p class="none">This source sends no lane history</p>`}</div>
    </div>
    <div class="g g-b">
      <div class="card chart"><div class="ch"><b>${key === '24h' ? 'Merges per hour' : 'Merges per day'}</b>
          <span class="key"><span><i class="ok"></i>Merged ${mergedIn}</span><span><i class="bad"></i>Failed or reverted</span></span></div>
        <${Bars} buckets=${buckets} label=${`Merges, ${words}: ${buckets.map(b => `${b.label} ${b.ok} merged, ${b.bad} failed or reverted`).join('; ')}`}
          tip=${b => `${b.ok} merged${b.bad ? `, ${b.bad} failed or reverted` : ''}`}/></div>
      <div class="card chart stuck"><div class="ch"><b>Stuck lanes</b><small>${words}</small></div>
        <b class=${'big ' + (stuck ? 'bad' : 'good')}>${stuck}</b><small>${stuck ? 'need a hand now' : 'nothing stuck now'}${hist.length ? ` · peak ${peak}` : ''}</small>
        ${trend.length > 1 && html`<${Spark} values=${trend} label=${`Stuck lanes, ${words}: ${trend.join(', ')}`}/>`}</div>
    </div>
    <div class="tiles">
      <div class="tile"><span>Supervision</span><b class=${'num ' + (healthy === fleet.homes.length ? 'good' : 'warn')}>${healthy}/${fleet.homes.length}</b><small>homes beating</small></div>
      <div class="tile"><span>Open incidents</span><b class=${'num ' + (incidents ? 'bad' : 'good')}>${incidents}</b><small>${incidents ? 'not resolved' : 'all clear'}</small></div>
      <div class="tile"><span>Quota run-out</span><b class="num">${q ? (q.runway_hours < 1 ? `${Math.round(q.runway_hours * 60)}m` : `${Math.round(q.runway_hours)}h`) : 'unknown'}</b><small>${q ? `${q.account}, ${q.window}` : 'no runway reported'}</small></div>
      <a class="tile" href="#/flow"><span>Time to merge today</span><b class="num">${today.length ? hm(pct(today, .5)) : 'none yet'}</b><small>${today.length ? `median of ${today.length} ${today.length === 1 ? 'merge' : 'merges'} ›` : 'no timed merge today'}</small></a>
    </div>
    <h2 class="h2">Hosts</h2>
    <div class="rows">${fleet.hosts.map(h => html`<div class="row" key=${h.id}><div class="t"><b>${h.name}</b><small>load ${h.load1} · sampled ${back(fleet, h.sampled_at)}</small></div>
      <div class="load"><span>CPU ${h.cpu_pct}%</span><${Meter} pct=${h.cpu_pct} label=${`${h.name} CPU ${h.cpu_pct}%`}/></div>
      <div class="load"><span>Memory ${h.mem_pct}%</span><${Meter} pct=${h.mem_pct} label=${`${h.name} memory ${h.mem_pct}%`}/></div></div>`)}</div>
    <a class="rows go" href="#/releases"><div class="row"><div class="t"><b>Releases</b><small>${fleet.releases.length} recent</small></div><span class="v">Open ›</span></div></a>`
}
