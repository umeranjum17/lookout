import { html, back, open, slotsOf } from './ui.js'
import { Line, Bars, Spark } from './charts.js'

const HOUR = 3600e3, DAY = 24 * HOUR
const sameDay = (a, b) => a.slice(0, 10) === b.slice(0, 10)
const Meter = ({ pct, label }) => html`<div class="bar" role="img" aria-label=${label}><i style=${{ width: `${Math.min(100, pct)}%` }}></i></div>`
export const RANGES = [['24h', 'Last 24 hours', DAY], ['7d', 'Last 7 days', 7 * DAY]]
const wday = (t, style = 'short') => new Date(t).toLocaleDateString('en', { weekday: style, timeZone: 'UTC' })

// Merges per hour over 24 hours, per UTC day over 7 days: ok = merged, bad = failed or reverted.
function mergeBuckets(fleet, range, to) {
  const spans = range === '24h'
    ? Array.from({ length: 24 }, (_, k) => [to - (24 - k) * HOUR, to - (23 - k) * HOUR, k === 23 ? 'the last hour' : `${24 - k} to ${23 - k} hours ago`,
      { 0: '24h ago', 6: '18h', 12: '12h', 18: '6h', 23: 'now' }[k]])
    : Array.from({ length: 7 }, (_, k) => { const d = Math.floor(to / DAY) * DAY - (6 - k) * DAY
      return [d, d + DAY, k === 6 ? 'today' : new Date(d).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }), k === 6 ? 'Today' : wday(d)] })
  return spans.map(([a, b, label, tick]) => {
    const ms = fleet.merges.filter(m => Date.parse(m.at) >= a && Date.parse(m.at) < b)
    return { ok: ms.filter(m => m.outcome === 'merged').length, bad: ms.filter(m => m.outcome !== 'merged').length, label, tick }
  })
}

export function Overview({ fleet, range }) {
  const lanes = open(fleet), slots = slotsOf(fleet), [key, name, span] = RANGES.find(([k]) => k === range) || RANGES[0], words = name.toLowerCase()
  const to = Date.parse(fleet.generated_at), from = to - span
  const hist = (fleet.history || []).map(h => ({ ...h, t: Date.parse(h.at) })).filter(h => h.t >= from && h.t <= to).sort((a, b) => a.t - b.t)
  const points = hist.map(h => ({ t: h.t, v: h.lanes, label: back(fleet, h.at) }))
  const ticks = key === '24h' ? [24, 18, 12, 6, 0].map(n => ({ t: to - n * HOUR, label: n === 24 ? '24h ago' : n ? `${n}h` : 'now' }))
    : Array.from({ length: 7 }, (_, k) => Math.floor(to / DAY) * DAY - k * DAY).map(t => ({ t, label: wday(t) }))
  const buckets = mergeBuckets(fleet, key, to), mergedIn = buckets.reduce((n, b) => n + b.ok, 0)
  const stuck = lanes.filter(l => l.stuck).length, peak = Math.max(0, ...hist.map(h => h.stuck))
  // Over 7 days the sparkline shows the worst of each 6 samples, so a week stays readable in a small card.
  const trend = key === '24h' ? hist.map(h => h.stuck) : hist.reduce((a, h, k) => (k % 6 ? a[a.length - 1] = Math.max(a.at(-1), h.stuck) : a.push(h.stuck), a), [])
  const healthy = fleet.homes.filter(h => h.supervision.state === 'ok').length
  const incidents = fleet.incidents.filter(i => !i.resolved_at).length
  const merged = fleet.merges.filter(m => m.outcome === 'merged' && sameDay(m.at, fleet.generated_at)).length
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
        ${points.length > 1 ? html`<${Line} points=${points} from=${from} to=${to} max=${Math.max(slots, ...points.map(p => p.v))} cap=${slots} ticks=${ticks}
          label=${`Lanes in use, ${words}: ${points.map(p => p.v).join(', ')}; ${slots} slots`} tip=${p => `${p.v} of ${slots} lanes`}/>`
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
      <div class="tile"><span>Merged today</span><b class="num">${merged}</b><small>${fleet.merges.filter(m => sameDay(m.at, fleet.generated_at) && m.outcome !== 'merged').length} failed or reverted</small></div>
    </div>
    <h2 class="h2">Hosts</h2>
    <div class="rows">${fleet.hosts.map(h => html`<div class="row" key=${h.id}><div class="t"><b>${h.name}</b><small>load ${h.load1} · sampled ${back(fleet, h.sampled_at)}</small></div>
      <div class="load"><span>CPU ${h.cpu_pct}%</span><${Meter} pct=${h.cpu_pct} label=${`${h.name} CPU ${h.cpu_pct}%`}/></div>
      <div class="load"><span>Memory ${h.mem_pct}%</span><${Meter} pct=${h.mem_pct} label=${`${h.name} memory ${h.mem_pct}%`}/></div></div>`)}</div>
    <a class="rows go" href="#/releases"><div class="row"><div class="t"><b>Releases</b><small>${fleet.releases.length} recent</small></div><span class="v">Open ›</span></div></a>`
}
