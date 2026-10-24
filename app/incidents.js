import { html, back, ago, pct, hm, State } from './ui.js'
import { Bars } from './charts.js'
import { lastDays } from './overview.js'

const DAY = 24 * 3600e3
const SEVERITY = { crit: 'Critical', warn: 'Warning', info: 'Info' }
const SHOWS = [['all', 'All'], ['open', 'Open'], ['resolved', 'Resolved']]
const words = k => k[0].toUpperCase() + k.slice(1)

// What broke and whether it is handled: open incidents first, then the newest. show and kind come from the link.
export function Incidents({ fleet, show = 'all', kind }) {
  const to = Date.parse(fleet.generated_at), all = [...fleet.incidents].sort((a, b) => !b.resolved_at - !a.resolved_at || b.at.localeCompare(a.at))
  const open = all.filter(i => !i.resolved_at), kinds = [...new Set(all.map(i => i.kind).filter(Boolean))].sort()
  const list = all.filter(i => (show === 'all' || (show === 'open') === !i.resolved_at) && (!kind || i.kind === kind))
  const href = (s, k) => `#/incidents?show=${s}${k ? `&kind=${k}` : ''}`
  const buckets = lastDays(to, 7).map(([d, label, tick]) => {
    const day = all.filter(i => Date.parse(i.at) >= d && Date.parse(i.at) < d + DAY)
    return { bad: day.filter(i => i.severity === 'crit').length, ok: day.filter(i => i.severity !== 'crit').length, label, tick }
  })
  const fixes = all.filter(i => i.resolved_at && Date.parse(i.at) >= to - 7 * DAY).map(i => Date.parse(i.resolved_at) - Date.parse(i.at)).sort((a, b) => a - b)
  const oldest = open.at(-1)
  return html`<div class="g g-a">
      <div class="card slots"><span class="lbl">Open now</span><b class=${'big ' + (open.some(i => i.severity === 'crit') ? 'bad' : open.length ? 'warn' : 'good')}>${open.length}</b>
        <small>${open.length ? Object.keys(SEVERITY).map(s => [s, open.filter(i => i.severity === s).length]).filter(([, n]) => n).map(([s, n]) => `${n} ${SEVERITY[s].toLowerCase()}`).join(' · ') : 'nothing open'}</small>
        <div class="homes">${kinds.filter(k => open.some(i => i.kind === k)).map(k => html`<a class="hm" key=${k} href=${href('open', k)}><span>${words(k)}</span>
          <span class="num">${open.filter(i => i.kind === k).length} open ›</span></a>`)}</div></div>
      <div class="card chart"><div class="ch"><b>Incidents per day</b>
          <span class="key"><span><i class="bad"></i>Critical</span><span><i class="ok"></i>Warning or info</span></span></div>
        <${Bars} buckets=${buckets} label=${`Incidents per day, last 7 days: ${buckets.map(b => `${b.label} ${b.bad} critical, ${b.ok} warning or info`).join('; ')}`}
          tip=${b => `${b.bad} critical, ${b.ok} warning or info`}/></div>
    </div>
    <div class="tiles three">
      <div class="tile"><span>Opened in 24 hours</span><b class="num">${all.filter(i => Date.parse(i.at) >= to - DAY).length}</b><small>out of ${all.length} listed</small></div>
      <div class="tile"><span>Time to resolve</span><b class="num">${fixes.length ? hm(pct(fixes, .5)) : 'unknown'}</b><small>${fixes.length ? `median of ${fixes.length}, last 7 days` : 'nothing resolved in 7 days'}</small></div>
      <div class="tile"><span>Oldest open</span><b class="num">${oldest ? ago(oldest.at, fleet.generated_at) : 'none'}</b><small>${oldest ? oldest.summary : 'all resolved'}</small></div>
    </div>
    <div class="chips" role="group" aria-label="Show">${SHOWS.map(([s, name]) => html`<a class=${'chip' + (s === show ? ' on' : '')} key=${s} href=${href(s, kind)} aria-current=${s === show ? 'true' : null}>
      ${name} · ${all.filter(i => (s === 'all' || (s === 'open') === !i.resolved_at) && (!kind || i.kind === kind)).length}</a>`)}</div>
    ${kinds.length > 0 && html`<div class="chips" role="group" aria-label="Kind"><a class=${'chip' + (!kind ? ' on' : '')} href=${href(show)} aria-current=${!kind ? 'true' : null}>Every kind</a>
      ${kinds.map(k => html`<a class=${'chip' + (k === kind ? ' on' : '')} key=${k} href=${href(show, k)} aria-current=${k === kind ? 'true' : null}>${words(k)}</a>`)}</div>`}
    ${list.length ? html`<div class="rows inc">${list.map(i => {
      const lane = fleet.lanes.find(l => l.id === i.lane), home = fleet.homes.find(h => h.id === i.home)
      const body = html`<${State} s=${i.severity} label=${SEVERITY[i.severity]}/><div class="t"><b>${i.summary}</b>
        <small>${[i.kind && words(i.kind), home?.name, lane?.title, `opened ${back(fleet, i.at)}`, i.resolved_at ? `resolved in ${hm(Date.parse(i.resolved_at) - Date.parse(i.at))}` : 'open'].filter(Boolean).join(' · ')}</small></div>`
      const go = lane ? `#/lane/${lane.id}` : home ? `#/project/${home.id}` : null
      return go ? html`<a class="row" key=${i.id} href=${go}>${body}<span class="v">›</span></a>` : html`<div class="row" key=${i.id}>${body}</div>`
    })}</div>` : html`<p class="none">No incidents match</p>`}`
}
