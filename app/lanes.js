import { html, when, open, STAGES } from './ui.js'

const NONE = { queued: 'Nothing queued.', working: 'Nothing being built.', review: 'Nothing in review.', merging: 'Nothing to merge.', done: 'Nothing landed.' }
const jump = k => e => { e.preventDefault(); document.getElementById('lane-' + k).scrollIntoView() }

// The board's line under the title: how many lanes across which homes, how many open and stuck.
export const boardSub = fleet => html`${fleet.lanes.length} lanes across ${new Intl.ListFormat('en').format(fleet.homes.map(h => h.name))}. ${open(fleet).length} open, ${fleet.lanes.filter(l => l.stuck).length} stuck. <a href="#/ops">Back to Ops</a>`

// One card per lane: stuck or waiting on you as a badge with its reason quoted under it, else who works it.
function Card({ fleet, lane }) {
  const ws = fleet.workers.filter(w => w.lane === lane.id && w.state !== 'exited'), waits = !lane.stuck && ws.some(w => w.state === 'waiting')
  const why = lane.stuck ? fleet.incidents.find(i => i.lane === lane.id && !i.resolved_at)?.summary || lane.waiting_on : waits && lane.waiting_on && `Waiting on ${lane.waiting_on}`
  return html`<div class="card"><a class="rt" href=${`#/lane/${lane.id}`}>${lane.title}</a><span class="meta">
    ${lane.stuck ? html`<span class="badge b-s">Stuck</span>` : waits && html`<span class="badge b-q">Waiting</span>`}${fleet.homes.find(h => h.id === lane.home)?.name}
    ${!lane.stuck && !waits && ws.map(w => html`<span key=${w.id}>${w.agent}, ${w.model}</span>`)}
    ${lane.pr_url && html`<a class="num" href=${lane.pr_url} rel="noreferrer">${'#' + lane.pr_url.split('/').pop()}</a>`}<span class="num">${when(fleet, lane.updated_at).split(' ')[0]}</span></span>${why && html`<q>${why}</q>`}</div>`
}

export function Lanes({ fleet, home }) {
  const cols = STAGES.map(([k, name]) => [k, name, fleet.lanes.filter(l => l.stage === k && (!home || l.home === home)).sort((a, b) => b.stuck - a.stuck || Date.parse(a.updated_at) - Date.parse(b.updated_at))])
  return html`<p class="stagelinks">${cols.map(([k, name, ls], i) => html`${i ? ' · ' : ''}<a href="#/lanes" onClick=${jump(k)}>${name} <b>${ls.length}</b></a>`)}</p>
    <div class="cols" style=${'--cols:' + cols.map(c => c[2].length ? 'minmax(0,1fr)' : '80px').join(' ')}>${cols.map(([k, name, ls]) => html`<div class=${'col' + (ls.length ? '' : ' empty')} id=${'lane-' + k} key=${k}>
      <h2><span class="nm">${name}</span> <span class="num">${ls.length}</span></h2>${ls.length ? ls.map(l => html`<${Card} fleet=${fleet} lane=${l} key=${l.id}/>`) : html`<div class="none">${NONE[k]}</div>`}</div>`)}</div>`
}
