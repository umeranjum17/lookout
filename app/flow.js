import { html, back, pct, hm } from './ui.js'
import { Line, Bars } from './charts.js'
import { mergeBuckets, wday } from './overview.js'

const HOUR = 3600e3, DAY = 24 * HOUR
const times = ms => ms.map(m => m.ms).sort((a, b) => a - b)

// How fast work lands and where it waits, over the last 7 days (whole UTC days, today included).
export function Flow({ fleet }) {
  const to = Date.parse(fleet.generated_at), day0 = Math.floor(to / DAY) * DAY - 6 * DAY, days = Array.from({ length: 7 }, (_, k) => day0 + k * DAY)
  const merged = fleet.merges.filter(m => m.outcome === 'merged' && Date.parse(m.at) >= day0)
  const timed = merged.filter(m => m.started_at).map(m => ({ ...m, ms: Date.parse(m.at) - Date.parse(m.started_at) })), all = times(timed)
  const points = days.map((d, k) => {
    const xs = times(timed.filter(m => Date.parse(m.at) >= d && Date.parse(m.at) < d + DAY))
    return xs.length && { t: d + DAY / 2, v: pct(xs, .5) / HOUR, hi: pct(xs, .9) / HOUR, n: xs.length, label: k === 6 ? 'today' : new Date(d).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }) }
  }).filter(Boolean)
  const ticks = days.map((d, k) => ({ t: d + DAY / 2, label: k === 6 ? 'Today' : wday(d) }))
  const graded = merged.filter(m => m.rework != null), first = graded.filter(m => m.rework === 0).length, sent = graded.reduce((n, m) => n + m.rework, 0)
  const buckets = mergeBuckets(fleet, '7d', to)
  const waits = Object.entries(fleet.lanes.filter(l => l.stage !== 'done' && l.waiting_on).reduce((g, l) => ({ ...g, [l.waiting_on]: [...(g[l.waiting_on] || []), l] }), {}))
    .sort((a, b) => b[1].length - a[1].length || Math.min(...a[1].map(l => Date.parse(l.updated_at))) - Math.min(...b[1].map(l => Date.parse(l.updated_at))))
  return html`<div class="g g-a">
      <div class="card slots"><span class="lbl">Time to merge</span><b class="big">${all.length ? hm(pct(all, .5)) : 'unknown'}</b>
        <small>${all.length ? `median · p90 ${hm(pct(all, .9))} · ${all.length} merges, last 7 days` : 'this source sends no merge start times'}</small>
        <div class="homes">${fleet.homes.map(h => {
          const xs = times(timed.filter(m => m.home === h.id))
          return html`<a class="hm" key=${h.id} href=${`#/project/${h.id}`}><span>${h.name}</span><span class="num">${xs.length} merged ›</span>
            <small>${xs.length ? `p50 ${hm(pct(xs, .5))} · p90 ${hm(pct(xs, .9))}` : 'no timed merges'}</small></a>`
        })}</div></div>
      <div class="card chart"><div class="ch"><b>Time to merge per day</b>
          <span class="key"><span><i class="ok"></i>p50</span><span><i class="hi"></i>p90</span></span></div>
        ${points.length > 1 ? html`<${Line} points=${points} from=${day0} to=${day0 + 7 * DAY} max=${Math.max(4, Math.ceil(Math.max(...points.map(p => p.hi))))} ticks=${ticks} unit="h"
          label=${`Time to merge per day, last 7 days: ${points.map(p => `${p.label} p50 ${hm(p.v * HOUR)}, p90 ${hm(p.hi * HOUR)}`).join('; ')}`}
          tip=${p => `p50 ${hm(p.v * HOUR)} · p90 ${hm(p.hi * HOUR)}`}/>` : html`<p class="none">Not enough timed merges to draw a trend</p>`}</div>
    </div>
    <div class="g g-b">
      <div class="card chart"><div class="ch"><b>Merges per day</b>
          <span class="key"><span><i class="ok"></i>Merged ${merged.length}</span><span><i class="bad"></i>Failed or reverted</span></span></div>
        <${Bars} buckets=${buckets} label=${`Merges, last 7 days: ${buckets.map(b => `${b.label} ${b.ok} merged, ${b.bad} failed or reverted`).join('; ')}`}
          tip=${b => `${b.ok} merged${b.bad ? `, ${b.bad} failed or reverted` : ''}`}/></div>
      <div class="card chart stuck"><div class="ch"><b>First pass</b><small>last 7 days</small></div>
        <b class="big">${graded.length ? `${Math.round(first / graded.length * 100)}%` : 'unknown'}</b>
        <small>${graded.length ? `${first} of ${graded.length} merges landed without going back; ${graded.length - first} were reworked, sent back ${sent} times` : 'this source sends no rework counts'}</small>
        ${graded.length > 0 && html`<div class="split" role="img" aria-label=${`${first} first pass, ${graded.length - first} reworked`}><i style=${{ flex: first }}></i><i class="re" style=${{ flex: graded.length - first }}></i></div>
          <span class="key"><span><i class="ok"></i>First pass</span><span><i class="hi"></i>Reworked</span></span>`}</div>
    </div>
    <h2 class="h2">Why work waits</h2>
    ${waits.length ? html`<div class="rows">${waits.flatMap(([why, ls]) => [...ls].sort((a, b) => a.updated_at.localeCompare(b.updated_at)).map(l => html`<a class="row" key=${l.id} href=${`#/lane/${l.id}`}>
        <div class="t"><b>${why[0].toUpperCase() + why.slice(1)}${ls.length > 1 ? ` · ${ls.length} lanes` : ''}</b><small>${l.title} · ${fleet.homes.find(h => h.id === l.home)?.name}</small></div>
        <span class="v num">waiting ${back(fleet, l.updated_at).replace(' ago', '')} ›</span></a>`))}</div>`
      : html`<p class="none">No lane says what it waits for</p>`}`
}
