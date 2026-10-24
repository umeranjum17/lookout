import { html, when, open, slotsOf, STAGES } from './ui.js'

const HEALTHY = { working: 'good', idle: 'warn', waiting: 'warn', exited: '' }

function Lane({ fleet, lane }) {
  const home = fleet.homes.find(h => h.id === lane.home), ws = fleet.workers.filter(w => w.lane === lane.id)
  return html`<li class=${'lane' + (lane.stuck ? ' stuck' : '')}>
    <b>${lane.title}</b>
    <small>${lane.project} · ${home.name}</small>
    ${ws.map(w => html`<small class=${'wk ' + HEALTHY[w.state]} key=${w.id}>${w.agent} ${w.model} · ${w.account} · ${w.state}</small>`)}
    <span class="meta">${lane.stuck ? html`<span class="pill bad">Stuck</span>` : ''}${lane.pr_url ? html`<a class="pr" href=${lane.pr_url} rel="noreferrer">PR</a>` : ''}<span class="v num">${when(fleet, lane.updated_at)}</span></span></li>`
}

export function Lanes({ fleet, home }) {
  const lanes = fleet.lanes.filter(l => !home || l.home === home), slots = slotsOf(fleet), used = open(fleet).length
  return html`<div class="chips" role="group" aria-label="Home">
      <a class=${'chip' + (!home ? ' on' : '')} href="#/lanes">All · ${used}/${slots}</a>
      ${fleet.homes.map(h => html`<a class=${'chip' + (home === h.id ? ' on' : '')} key=${h.id} href=${`#/lanes?home=${h.id}`}>${h.name} · ${open(fleet).filter(l => l.home === h.id).length}/${h.lane_cap}</a>`)}</div>
    <div class="board">${STAGES.map(([k, name]) => {
      const col = lanes.filter(l => l.stage === k).sort((a, b) => b.stuck - a.stuck || Date.parse(a.updated_at) - Date.parse(b.updated_at))
      return html`<section key=${k}><h2 class="h2">${name} <span class="n num">${col.length}</span></h2>
        ${col.length ? html`<ul>${col.map(l => html`<${Lane} fleet=${fleet} lane=${l} key=${l.id}/>`)}</ul>` : html`<p class="none">No lanes</p>`}</section>`
    })}</div>`
}
