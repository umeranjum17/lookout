import { html, back, ago, open, STAGES, laneOrder } from './ui.js'

const Meter = ({ pct, label }) => html`<div class="bar" role="img" aria-label=${label}><i style=${{ width: `${Math.min(100, pct)}%` }}></i></div>`
const Missing = ({ what }) => html`<div class="card empty"><b>${what} not found</b><a class="pr" href="#/lanes">Back to lanes</a></div>`
const Facts = ({ rows }) => html`<div class="rows">${rows.filter(Boolean).map(([k, v]) => html`<div class="row" key=${k}><div class="t"><small>${k}</small></div><span class="v">${v}</span></div>`)}</div>`

function PrevNext({ items, id, href }) {
  const i = items.findIndex(x => x.id === id), go = (x, label) => x ? html`<a class="chip" href=${href(x)}>${label}</a>` : html`<span class="chip off">${label}</span>`
  return html`<div class="pn">${go(items[i - 1], '‹ Previous')}<span class="n num">${i + 1} of ${items.length}</span>${go(items[i + 1], 'Next ›')}</div>`
}

export function LanePage({ fleet, id }) {
  const lane = fleet.lanes.find(l => l.id === id)
  if (!lane) return html`<${Missing} what="Lane"/>`
  const home = fleet.homes.find(h => h.id === lane.home), at = STAGES.findIndex(s => s[0] === lane.stage)
  const ws = fleet.workers.filter(w => w.lane === id), inc = fleet.incidents.filter(i => i.lane === id), mg = fleet.merges.filter(m => m.lane === id)
  return html`<${PrevNext} items=${laneOrder(fleet)} id=${id} href=${l => `#/lane/${l.id}`}/>
    <ol class="steps" aria-label="Stage">${STAGES.map(([k, name], i) => html`<li key=${k} class=${i < at ? 'past' : i === at ? 'now' : ''} aria-current=${i === at ? 'step' : null}>${name}</li>`)}</ol>
    <${Facts} rows=${[['Status', lane.stuck ? html`<span class="pill bad">Stuck</span>` : lane.stage === 'done' ? 'Done' : 'Moving'],
      ['Home', html`<a class="pr" href=${`#/project/${home.id}`}>${home.name}</a>`], ['Project', lane.project],
      ['Started', back(fleet, lane.started_at)], ['Last update', back(fleet, lane.updated_at)],
      lane.pr_url && ['Pull request', html`<a class="pr" href=${lane.pr_url} rel="noreferrer">Open</a>`]]}/>
    <h2 class="h2">Workers</h2>
    ${ws.length ? html`<div class="rows">${ws.map(w => html`<div class="row" key=${w.id}><div class="t"><b>${w.agent} ${w.model}</b><small>${w.account} · active ${back(fleet, w.last_activity_at)}</small></div><span class="pill">${w.state}</span></div>`)}</div>` : html`<p class="none">No worker on this lane</p>`}
    ${inc.length ? html`<h2 class="h2">Incidents</h2><div class="rows">${inc.map(i => html`<div class="row" key=${i.id}><div class="t"><b>${i.summary}</b><small>${i.severity} · ${back(fleet, i.at)}${i.resolved_at ? ' · resolved' : ''}</small></div></div>`)}</div>` : ''}
    ${mg.length ? html`<h2 class="h2">Merges</h2><div class="rows">${mg.map(m => html`<div class="row" key=${m.at}><div class="t"><b>${m.title}</b><small>${m.outcome} · checks ${m.checks} · ${back(fleet, m.at)}</small></div></div>`)}</div>` : ''}`
}

export function ProjectPage({ fleet, id }) {
  const home = fleet.homes.find(h => h.id === id)
  if (!home) return html`<${Missing} what="Project"/>`
  const lanes = laneOrder(fleet).filter(l => l.home === id), live = open(fleet).filter(l => l.home === id), host = fleet.hosts.find(h => h.id === home.host)
  const ids = new Set(lanes.map(l => l.id)), mg = fleet.merges.filter(m => ids.has(m.lane)), inc = fleet.incidents.filter(i => i.home === id)
  return html`<${PrevNext} items=${fleet.homes} id=${id} href=${h => `#/project/${h.id}`}/>
    <div class="card hero"><span>Lanes against the cap</span><b class="num">${live.length} of ${home.lane_cap}</b>
      <${Meter} pct=${live.length / home.lane_cap * 100} label=${`${live.length} of ${home.lane_cap} lanes`}/></div>
    <${Facts} rows=${[['Supervision', html`<span class=${'pill ' + (home.supervision.state === 'ok' ? 'good' : 'warn')}>${home.supervision.state}</span>`],
      ['Last beat', back(fleet, home.supervision.last_beat_at)], home.supervision.note && ['Note', home.supervision.note],
      host && ['Host', `${host.name} · CPU ${host.cpu_pct}% · memory ${host.mem_pct}%`]]}/>
    <h2 class="h2">Lanes <span class="n num">${lanes.length}</span></h2>
    ${lanes.length ? html`<div class="rows">${lanes.map(l => html`<a class="row" key=${l.id} href=${`#/lane/${l.id}`}><div class="t"><b>${l.title}</b><small>${l.project} · ${l.stage}${l.stuck ? ' · stuck' : ''}</small></div><span class="v num">${ago(l.updated_at, fleet.generated_at)}</span></a>`)}</div>` : html`<p class="none">No lanes</p>`}
    ${mg.length ? html`<h2 class="h2">Merges</h2><div class="rows">${mg.map(m => html`<div class="row" key=${m.at}><div class="t"><b>${m.title}</b><small>${m.outcome} · ${back(fleet, m.at)}</small></div></div>`)}</div>` : ''}
    ${inc.length ? html`<h2 class="h2">Incidents</h2><div class="rows">${inc.map(i => html`<div class="row" key=${i.id}><div class="t"><b>${i.summary}</b><small>${i.severity} · ${back(fleet, i.at)}${i.resolved_at ? ' · resolved' : ''}</small></div></div>`)}</div>` : ''}`
}
