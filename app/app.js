import { html, render, useState, useEffect } from './vendor/preact-htm-3.1.1.js'

const ICONS = {
  overview: 'M2.5 8.5L8 3l5.5 5.5M4 7.5v5.5h8V7.5',
  lanes: 'M2.5 4.5h11M2.5 8h11M2.5 11.5h7',
  flow: 'M2.5 12l3.5-5 3 3 4.5-6.5',
  capacity: 'M3 12.5a5.5 5.5 0 1 1 10 0M8 12l2.5-4',
  releases: 'M8 2.5l4.5 2.5v6L8 13.5 3.5 11V5zM8 8v5.5M3.5 5L8 8l4.5-3',
  incidents: 'M8 2.5l6 10.5H2zM8 7v3M8 11.5v.01',
  projects: 'M2.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z',
}
const Icon = ({ n }) => html`<svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${ICONS[n]}/></svg>`

// The screens in nav order. The phone dock holds the first `dock` of them; Releases and Projects stay in the sidebar and Overview.
const SCREENS = [['overview', 'Overview'], ['lanes', 'Lanes'], ['flow', 'Flow'], ['capacity', 'Capacity'], ['incidents', 'Incidents'], ['releases', 'Releases'], ['projects', 'Projects']]
const DOCK = ['overview', 'lanes', 'flow', 'capacity', 'incidents']

const ago = (from, to) => {
  const s = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000))
  return s < 60 ? 'now' : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m` : `${Math.floor(s / 86400)}d`
}
const when = (fleet, t) => ago(t, fleet.generated_at)
const route = () => SCREENS.find(([k]) => k === location.hash.slice(2))?.[0] || 'overview'

function Overview({ fleet }) {
  const open = fleet.lanes.filter(l => l.stage !== 'done'), slots = fleet.homes.reduce((n, h) => n + h.lane_cap, 0)
  const stuck = open.filter(l => l.stuck).length, healthy = fleet.homes.filter(h => h.supervision.state === 'ok').length
  const incidents = fleet.incidents.filter(i => !i.resolved_at).length
  const q = fleet.quota.filter(x => x.runway_hours != null).sort((a, b) => a.runway_hours - b.runway_hours)[0]
  return html`<div class="card hero"><span>Lanes in use</span><b class="num">${open.length} of ${slots} slots</b>
      <div class="bar" role="img" aria-label=${`${open.length} of ${slots} slots in use`}><i style=${{ width: `${slots ? Math.min(100, open.length / slots * 100) : 0}%` }}></i></div></div>
    <div class="tiles">
      <div class="tile"><span>Stuck</span><b class=${'num ' + (stuck ? 'bad' : 'good')}>${stuck}</b><small>${stuck ? 'lanes need a hand' : 'nothing stuck'}</small></div>
      <div class="tile"><span>Supervision</span><b class=${'num ' + (healthy === fleet.homes.length ? 'good' : 'warn')}>${healthy}/${fleet.homes.length}</b><small>homes beating</small></div>
      <div class="tile"><span>Open incidents</span><b class=${'num ' + (incidents ? 'bad' : 'good')}>${incidents}</b><small>${incidents ? 'not resolved' : 'all clear'}</small></div>
      <div class="tile"><span>Quota run-out</span><b class="num">${q ? (q.runway_hours < 1 ? `${Math.round(q.runway_hours * 60)}m` : `${Math.round(q.runway_hours)}h`) : 'unknown'}</b><small>${q ? `${q.account}, ${q.window}` : 'no runway reported'}</small></div>
    </div>
    <a class="rows" href="#/releases"><div class="row"><div class="t"><b>Releases</b><small>${fleet.releases.length} recent</small></div><span class="v">Open ›</span></div></a>`
}

function Projects({ fleet }) {
  return html`<div class="rows">${fleet.homes.map(h => {
    const n = fleet.lanes.filter(l => l.home === h.id && l.stage !== 'done').length
    return html`<div class="row" key=${h.id}><div class="t"><b>${h.name}</b><small>${fleet.hosts.find(x => x.id === h.host)?.name} · beat ${when(fleet, h.supervision.last_beat_at)} ago</small></div>
      <span class=${'pill ' + (h.supervision.state === 'ok' ? 'good' : 'warn')}>${h.supervision.state}</span><span class="v num">${n}/${h.lane_cap} lanes</span></div>`
  })}</div>`
}

const Soon = ({ title }) => html`<div class="card empty"><b>${title} is not built yet</b><span>This screen arrives in a following release.</span></div>`

function App() {
  const [data, setData] = useState(null), [view, setView] = useState(route())
  useEffect(() => {
    const on = () => setView(route()); addEventListener('hashchange', on)
    const t = new URLSearchParams(location.search).get('theme'); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t
    const load = () => fetch('/api/fleet').then(r => r.json()).then(setData, e => setData({ error: String(e) }))
    load(); const id = setInterval(load, 30000)
    return () => { removeEventListener('hashchange', on); clearInterval(id) }
  }, [])
  if (!data) return html`<div class="fail"><span class="sub">Loading</span></div>`
  if (data.error) return html`<div class="fail"><h1>Lookout cannot read the fleet</h1><p>${data.error}</p>${data.problems?.length ? html`<pre>${data.problems.join('\n')}</pre>` : ''}</div>`
  const { fleet, version } = data, title = SCREENS.find(([k]) => k === view)[1]
  const link = ([k, name], cls) => html`<a class=${cls} href=${'#/' + k} aria-current=${view === k ? 'page' : null}><${Icon} n=${k}/>${cls === 'nav' ? name : html`<span>${name}</span>`}</a>`
  return html`<div class="app"><nav class="side" aria-label="Screens"><div class="brand"><span class="mark">L</span>Lookout</div>
      ${SCREENS.slice(0, 6).map(s => link(s, 'nav'))}<div class="sec"></div>${link(SCREENS[6], 'nav')}<div class="ver num">Lookout ${version}</div></nav>
    <main class="main"><h1>${title}</h1><p class="sub">${fleet.name} · updated ${when(fleet, fleet.generated_at) === 'now' ? 'just now' : when(fleet, fleet.generated_at) + ' ago'}</p>
      ${view === 'overview' ? html`<${Overview} fleet=${fleet}/>` : view === 'projects' ? html`<${Projects} fleet=${fleet}/>` : html`<${Soon} title=${title}/>`}</main>
    <nav class="dock" aria-label="Screens">${SCREENS.filter(([k]) => DOCK.includes(k)).map(s => link(s, 'dk'))}</nav></div>`
}
render(html`<${App}/>`, document.getElementById('app'))
