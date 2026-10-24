import { html, back, open, slotsOf } from './ui.js'

const sameDay = (a, b) => a.slice(0, 10) === b.slice(0, 10)
const Meter = ({ pct, label }) => html`<div class="bar" role="img" aria-label=${label}><i style=${{ width: `${Math.min(100, pct)}%` }}></i></div>`

export function Overview({ fleet }) {
  const lanes = open(fleet), slots = slotsOf(fleet)
  const stuck = lanes.filter(l => l.stuck).length, healthy = fleet.homes.filter(h => h.supervision.state === 'ok').length
  const incidents = fleet.incidents.filter(i => !i.resolved_at).length
  const merged = fleet.merges.filter(m => m.outcome === 'merged' && sameDay(m.at, fleet.generated_at)).length
  const q = fleet.quota.filter(x => x.runway_hours != null).sort((a, b) => a.runway_hours - b.runway_hours)[0]
  return html`<div class="card hero"><span>Lanes in use</span><b class="num">${lanes.length} of ${slots} slots</b>
      <${Meter} pct=${slots ? lanes.length / slots * 100 : 0} label=${`${lanes.length} of ${slots} slots in use`}/></div>
    <div class="tiles">
      <div class="tile"><span>Stuck</span><b class=${'num ' + (stuck ? 'bad' : 'good')}>${stuck}</b><small>${stuck ? 'lanes need a hand' : 'nothing stuck'}</small></div>
      <div class="tile"><span>Supervision</span><b class=${'num ' + (healthy === fleet.homes.length ? 'good' : 'warn')}>${healthy}/${fleet.homes.length}</b><small>homes beating</small></div>
      <div class="tile"><span>Open incidents</span><b class=${'num ' + (incidents ? 'bad' : 'good')}>${incidents}</b><small>${incidents ? 'not resolved' : 'all clear'}</small></div>
      <div class="tile"><span>Quota run-out</span><b class="num">${q ? (q.runway_hours < 1 ? `${Math.round(q.runway_hours * 60)}m` : `${Math.round(q.runway_hours)}h`) : 'unknown'}</b><small>${q ? `${q.account}, ${q.window}` : 'no runway reported'}</small></div>
      <div class="tile"><span>Merged today</span><b class="num">${merged}</b><small>${fleet.merges.filter(m => sameDay(m.at, fleet.generated_at) && m.outcome !== 'merged').length} failed or reverted</small></div>
    </div>
    <h2 class="h2">Hosts</h2>
    <div class="rows">${fleet.hosts.map(h => html`<div class="row" key=${h.id}><div class="t"><b>${h.name}</b><small>load ${h.load1} · sampled ${back(fleet, h.sampled_at)}</small></div>
      <div class="load"><span>CPU ${h.cpu_pct}%</span><${Meter} pct=${h.cpu_pct} label=${`${h.name} CPU ${h.cpu_pct}%`}/></div>
      <div class="load"><span>Memory ${h.mem_pct}%</span><${Meter} pct=${h.mem_pct} label=${`${h.name} memory ${h.mem_pct}%`}/></div></div>`)}</div>
    <h2 class="h2">Homes</h2>
    <div class="rows">${fleet.homes.map(h => {
      const n = lanes.filter(l => l.home === h.id).length
      return html`<a class="row" key=${h.id} href=${`#/lanes?home=${h.id}`}><div class="t"><b>${h.name}</b><small>${n} of ${h.lane_cap} lanes${n > h.lane_cap ? ' · over the cap' : ''}</small></div>
        <div class="load"><${Meter} pct=${n / h.lane_cap * 100} label=${`${h.name}: ${n} of ${h.lane_cap} lanes`}/></div><span class="v">›</span></a>`
    })}</div>
    <a class="rows go" href="#/releases"><div class="row"><div class="t"><b>Releases</b><small>${fleet.releases.length} recent</small></div><span class="v">Open ›</span></div></a>`
}
