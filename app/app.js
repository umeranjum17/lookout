import { html, render, useState, useEffect } from './vendor/preact-htm-3.1.1.js'
import { back, open } from './ui.js'
import { Ops, answers } from './overview.js'
import { Lanes, boardSub } from './lanes.js'
import { Flow } from './flow.js'
import { Capacity } from './capacity.js'
import { Incidents } from './incidents.js'
import { Releases } from './releases.js'
import { LanePage, ProjectPage } from './pages.js'

// The screens in nav order. The phone title row holds Ops and Board, the rest sit at the foot of each phone screen. The board hides the rail.
const SCREENS = [['ops', 'Ops'], ['lanes', 'Board'], ['flow', 'Flow'], ['capacity', 'Capacity'], ['incidents', 'Incidents'], ['releases', 'Releases'], ['projects', 'Projects']]
const utc = (t, o) => new Date(t).toLocaleString('en-GB', { ...o, hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'
const toggle = () => { const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; r.dataset.theme = dark ? 'light' : 'dark' }
const Theme = () => html`<button class="btn theme" type="button" onClick=${toggle} aria-label="Toggle dark theme">☾</button>`

// #/<screen>?home=<id>&range=<7d|30d>&show=<all|open|resolved>&kind=<kind>, #/lane/<id>, #/project/<id>. A detail page sits under its list's nav entry.
const route = () => {
  const [p, q] = location.hash.slice(2).split('?'), [head, id] = p.split('/')
  if ((head === 'lane' || head === 'project') && id) return { view: head, id: decodeURIComponent(id), nav: head + 's' }
  const view = SCREENS.find(([k]) => k === p)?.[0] || 'ops'
  const sp = new URLSearchParams(q)
  return { view, nav: view, home: sp.get('home'), range: sp.get('range'), show: sp.get('show') || undefined, kind: sp.get('kind') }
}

function Projects({ fleet }) {
  return html`<div class="rows">${fleet.homes.map(h => {
    const n = fleet.lanes.filter(l => l.home === h.id && l.stage !== 'done').length
    return html`<a class="row" key=${h.id} href=${`#/project/${h.id}`}><div class="t"><b>${h.name}</b><small>${fleet.hosts.find(x => x.id === h.host)?.name} · beat ${back(fleet, h.supervision.last_beat_at)}</small></div>
      <span class=${'pill ' + (h.supervision.state === 'ok' ? 'good' : 'warn')}>${h.supervision.state}</span><span class="v num">${n}/${h.lane_cap} lanes</span><span class="v">›</span></a>`
  })}</div>`
}

function App() {
  const [data, setData] = useState(null), [{ view, nav, home, range, show, kind, id }, setRoute] = useState(route())
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
  const live = open(fleet), counts = { ops: answers(fleet).waiting.length, lanes: live.length }
  const link = ([k, name], cls) => html`<a class=${cls} key=${k} href=${'#/' + k} aria-current=${nav === k ? 'page' : null}>${name}${cls !== 'btn' && counts[k] != null ? html` <span class="num">${counts[k]}</span>` : ''}</a>`
  return html`<div class=${'app' + (view === 'lanes' ? ' solo' : '')}><aside class="side" aria-label="Fleet"><div class="side-head">Fleet <span class="tag">${fleet.name}</span></div>
      <nav class="nav" aria-label="Screens">${SCREENS.map(s => link(s))}</nav>
      <div class="hlist"><p>Homes</p>${fleet.homes.map(h => { const n = live.filter(l => l.home === h.id).length
        return html`<a key=${h.id} href=${`#/project/${h.id}`}>${h.name} ${n ? html`<span class="marks" role="img" aria-label=${`${n} lanes, plan ${h.lane_cap}`}>${Array.from({ length: n }, (_, k) => html`<i class=${k < h.lane_cap ? '' : 'over'}></i>`)}</span>` : html`<span class="meta">0 lanes</span>`}</a>` })}</div>
      <div class="user"><span>Lookout ${version}<br/>${utc(fleet.generated_at)}</span><${Theme}/></div></aside>
    <main class="main"><div class="titlerow"><h1>${title}</h1><span class="sub">${view === 'lanes' ? boardSub(fleet) : `${fleet.name}, ${utc(fleet.generated_at, { weekday: 'short', day: 'numeric', month: 'short' })}`}</span>
        <nav class="phonenav" aria-label="Screens">${SCREENS.slice(0, 2).map(s => link(s, 'btn'))}<${Theme}/></nav></div>
      ${view === 'ops' ? html`<${Ops} fleet=${fleet}/>` : view === 'lanes' ? html`<${Lanes} fleet=${fleet} home=${home}/>` : view === 'flow' ? html`<${Flow} fleet=${fleet} range=${range}/>` : view === 'capacity' ? html`<${Capacity} fleet=${fleet}/>` : view === 'incidents' ? html`<${Incidents} fleet=${fleet} show=${show} kind=${kind}/>` : view === 'releases' ? html`<${Releases} fleet=${fleet}/>` : view === 'projects' ? html`<${Projects} fleet=${fleet}/>` : view === 'lane' ? html`<${LanePage} fleet=${fleet} id=${id}/>` : html`<${ProjectPage} fleet=${fleet} id=${id}/>`}
      <nav class="more" aria-label="More screens">${SCREENS.slice(2).map(s => link(s, 'btn'))}</nav><footer class="foot num">Lookout ${version}</footer></main></div>`
}
render(html`<${App}/>`, document.getElementById('app'))
