import { html, back, State } from './ui.js'
import { Bars } from './charts.js'
import { lastDays } from './overview.js'

const DAY = 24 * 3600e3
// A target in words against now: in 6d, today or 1d late.
const due = (t, now) => { const d = Math.round((Date.parse(t) - now) / DAY); return d > 0 ? `in ${d}d` : d === 0 ? 'today' : `${-d}d late` }
const Meter = ({ pct, label }) => html`<div class="bar" role="img" aria-label=${label}><i style=${{ width: `${Math.min(100, pct)}%` }}></i></div>`

// Per repository: what is live (the newest shipped release) against what is in development (its plan).
export function Releases({ fleet }) {
  const now = Date.parse(fleet.generated_at), plans = fleet.plans || []
  const repos = [...new Set([...fleet.releases.map(r => r.repo), ...plans.map(p => p.repo)])].sort()
  const buckets = lastDays(now, 30).map(([d, label, tick]) => {
    const rs = fleet.releases.filter(r => Date.parse(r.at) >= d && Date.parse(r.at) < d + DAY)
    return { ok: rs.filter(r => r.status === 'shipped').length, bad: rs.filter(r => r.status === 'failed').length, label, tick }
  })
  const dated = plans.filter(p => p.target).sort((a, b) => a.target.localeCompare(b.target)), next = dated[0]
  const late = next && Date.parse(next.target) < now - DAY / 2
  return html`<div class="g g-a">
      <div class="card slots"><span class="lbl">Next target</span><b class=${'big ' + (late ? 'warn' : '')}>${next ? due(next.target, now) : 'none set'}</b>
        <small>${next ? `${next.repo} ${next.version} · ${next.items.filter(i => i.done).length} of ${next.items.length} items done` : 'no plan has a target date'}</small>
        <div class="homes">${dated.map(p => html`<div class="hm" key=${p.repo}><span>${p.repo} ${p.version}</span><span class="num">${due(p.target, now)}</span></div>`)}</div></div>
      <div class="card chart"><div class="ch"><b>Releases per day</b>
          <span class="key"><span><i class="ok"></i>Shipped ${buckets.reduce((n, b) => n + b.ok, 0)}</span><span><i class="bad"></i>Failed</span></span></div>
        <${Bars} buckets=${buckets} label=${`Releases per day, last 30 days: ${buckets.filter(b => b.ok + b.bad).map(b => `${b.label} ${b.ok} shipped, ${b.bad} failed`).join('; ')}`}
          tip=${b => `${b.ok} shipped${b.bad ? `, ${b.bad} failed` : ''}`}/></div>
    </div>
    <div class="g hosts">${repos.map(repo => {
      const rs = fleet.releases.filter(r => r.repo === repo).sort((a, b) => b.at.localeCompare(a.at)), live = rs.find(r => r.status === 'shipped'), tried = rs[0]
      const plan = plans.find(p => p.repo === repo), done = plan ? plan.items.filter(i => i.done).length : 0, home = fleet.homes.find(h => h.id === plan?.home)
      return html`<div class="card rel" key=${repo}><div class="ch"><b>${repo}</b>${home && html`<small>${home.name}</small>`}</div>
        <div class="two"><div><span class="lbl">Live</span><b class="rv num">${live ? live.version : 'nothing shipped'}</b>
            ${live && html`<small>shipped ${back(fleet, live.at)} · ${live.channel}${live.source ? ` · confirmed on ${live.source}` : ''}</small>`}
            ${live?.url && html`<a class="pr" href=${live.url} rel="noreferrer">Release page</a>`}
            ${tried && tried !== live && html`<div class="tried"><${State} s=${tried.status}/><small>${tried.version} on ${tried.channel}, ${back(fleet, tried.at)}</small></div>`}</div>
          <div><span class="lbl">In development</span><b class="rv num">${plan ? plan.version : 'no plan'}</b>
            ${plan && html`<small>${plan.target ? `target ${due(plan.target, now)}` : 'no target date'} · ${done} of ${plan.items.length} items done</small>
              <${Meter} pct=${plan.items.length ? done / plan.items.length * 100 : 0} label=${`${repo} ${plan.version}: ${done} of ${plan.items.length} items done`}/>
              <ul class="items">${plan.items.map(i => html`<li key=${i.title} class=${i.done ? 'done' : ''}>${i.title}</li>`)}</ul>`}</div></div>
      </div>`
    })}</div>`
}
