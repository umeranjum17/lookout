import { html, render, useState, useEffect } from './vendor/preact-htm-3.1.1.js'
import { back } from './ui.js'
import { Overview } from './overview.js'
import { Lanes } from './lanes.js'
import { Flow } from './flow.js'
import { LanePage, ProjectPage } from './pages.js'

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

// #/<screen>?home=<id>&range=<24h|7d>, #/lane/<id>, #/project/<id>. A detail page sits under its list's nav entry.
const route = () => {
  const [p, q] = location.hash.slice(2).split('?'), [head, id] = p.split('/')
  if ((head === 'lane' || head === 'project') && id) return { view: head, id: decodeURIComponent(id), nav: head + 's' }
  const view = SCREENS.find(([k]) => k === p)?.[0] || 'overview'
  const sp = new URLSearchParams(q)
  return { view, nav: view, home: sp.get('home'), range: sp.get('range') }
}

function Projects({ fleet }) {
  return html`<div class="rows">${fleet.homes.map(h => {
    const n = fleet.lanes.filter(l => l.home === h.id && l.stage !== 'done').length
    return html`<a class="row" key=${h.id} href=${`#/project/${h.id}`}><div class="t"><b>${h.name}</b><small>${fleet.hosts.find(x => x.id === h.host)?.name} · beat ${back(fleet, h.supervision.last_beat_at)}</small></div>
      <span class=${'pill ' + (h.supervision.state === 'ok' ? 'good' : 'warn')}>${h.supervision.state}</span><span class="v num">${n}/${h.lane_cap} lanes</span><span class="v">›</span></a>`
  })}</div>`
}

const Soon = ({ title }) => html`<div class="card empty"><b>${title} is not built yet</b><span>This screen arrives in a following release.</span></div>`

function App() {
  const [data, setData] = useState(null), [{ view, nav, home, range, id }, setRoute] = useState(route())
  useEffect(() => {
    const on = () => setRoute(route()); addEventListener('hashchange', on)
    const t = new URLSearchParams(location.search).get('theme'); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t
    const load = () => fetch('/api/fleet').then(r => r.json()).then(setData, e => setData({ error: String(e) }))
    load(); const id = setInterval(load, 30000)
    return () => { removeEventListener('hashchange', on); clearInterval(id) }
  }, [])
  if (!data) return html`<div class="fail"><span class="sub">Loading</span></div>`
  if (data.error) return html`<div class="fail"><h1>Lookout cannot read the fleet</h1><p>${data.error}</p>${data.problems?.length ? html`<pre>${data.problems.join('\n')}</pre>` : ''}</div>`
  const { fleet, version } = data, title = view === 'lane' ? fleet.lanes.find(l => l.id === id)?.title || 'Lane' : view === 'project' ? fleet.homes.find(h => h.id === id)?.name || 'Project' : SCREENS.find(([k]) => k === view)[1]
  const link = ([k, name], cls) => html`<a class=${cls} href=${'#/' + k} aria-current=${nav === k ? 'page' : null}><${Icon} n=${k}/>${cls === 'nav' ? name : html`<span>${name}</span>`}</a>`
  return html`<div class="app"><nav class="side" aria-label="Screens"><div class="brand"><span class="mark">L</span>Lookout</div>
      ${SCREENS.slice(0, 6).map(s => link(s, 'nav'))}<div class="sec"></div>${link(SCREENS[6], 'nav')}<div class="ver num">Lookout ${version}</div></nav>
    <main class="main"><h1>${title}</h1><p class="sub">${fleet.name} · updated ${back(fleet, fleet.generated_at)}</p>
      ${view === 'overview' ? html`<${Overview} fleet=${fleet} range=${range}/>` : view === 'lanes' ? html`<${Lanes} fleet=${fleet} home=${home}/>` : view === 'flow' ? html`<${Flow} fleet=${fleet}/>` : view === 'projects' ? html`<${Projects} fleet=${fleet}/>` : view === 'lane' ? html`<${LanePage} fleet=${fleet} id=${id}/>` : view === 'project' ? html`<${ProjectPage} fleet=${fleet} id=${id}/>` : html`<${Soon} title=${title}/>`}</main>
    <nav class="dock" aria-label="Screens">${SCREENS.filter(([k]) => DOCK.includes(k)).map(s => link(s, 'dk'))}</nav></div>`
}
render(html`<${App}/>`, document.getElementById('app'))
