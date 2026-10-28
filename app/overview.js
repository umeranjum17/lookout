import { html, when, open, slotsOf, STAGES } from './ui.js'

const HOUR = 3600e3, DAY = 24 * HOUR
export const wday = (t, style = 'short') => new Date(t).toLocaleDateString('en', { weekday: style, timeZone: 'UTC' })

// The last n whole UTC days, today included, as [start, name, axis label]: 7 days label each weekday, longer runs every 7th day.
export const lastDays = (to, n) => Array.from({ length: n }, (_, k) => {
  const d = Math.floor(to / DAY) * DAY - (n - 1 - k) * DAY, today = k === n - 1
  return [d, today ? 'today' : new Date(d).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }),
    today ? 'Today' : n <= 7 ? wday(d) : (n - 1 - k) % 7 ? undefined : new Date(d).toLocaleDateString('en', { day: 'numeric', month: 'short', timeZone: 'UTC' })]
})

// Merges per hour over 24 hours, per UTC day over 7, 14 or 30 days: ok = merged, bad = failed or reverted.
export function mergeBuckets(fleet, range, to) {
  const spans = range === '24h'
    ? Array.from({ length: 24 }, (_, k) => [to - (24 - k) * HOUR, to - (23 - k) * HOUR, k === 23 ? 'the last hour' : `${24 - k} to ${23 - k} hours ago`,
      { 0: '24h ago', 6: '18h', 12: '12h', 18: '6h', 23: 'now' }[k]])
    : lastDays(to, parseInt(range)).map(([d, label, tick]) => [d, d + DAY, label, tick])
  return spans.map(([a, b, label, tick]) => {
    const ms = fleet.merges.filter(m => Date.parse(m.at) >= a && Date.parse(m.at) < b)
    return { t: a, ok: ms.filter(m => m.outcome === 'merged').length, bad: ms.filter(m => m.outcome !== 'merged').length, label, tick }
  })
}

// Ops sorts every open lane into one answer: stuck, waiting on you (a worker waits for input), or running (a worker works).
export function answers(fleet) {
  const live = open(fleet).sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at))
  const has = (l, s) => fleet.workers.some(w => w.lane === l.id && w.state === s)
  const stuck = live.filter(l => l.stuck), waiting = live.filter(l => !l.stuck && has(l, 'waiting'))
  return { live, stuck, waiting, running: live.filter(l => !l.stuck && !waiting.includes(l) && has(l, 'working')) }
}

const Rows = ({ fleet, lanes, badge, note, act = true }) => html`<ul class="list">${lanes.map(l => html`<li class="item" key=${l.id}>
  <span class=${'badge ' + badge[0]}>${badge[1] || STAGES.find(s => s[0] === l.stage).slice(1).at(-1)}</span>
  <a class="rt" href=${`#/lane/${l.id}`}>${l.title}${note(l) && html`<span class="note">${note(l)}</span>`}</a>
  <span class="meta home">${fleet.homes.find(h => h.id === l.home)?.name}</span><span class="meta age num">${when(fleet, l.updated_at).split(' ')[0]}</span>
  <span class="acts">${act && html`<a class="btn" href=${`#/lane/${l.id}`}>Open lane</a>`}</span></li>`)}</ul>`
const Block = ({ id, name, n, children }) => html`<section class="block" id=${id} aria-labelledby=${'h-' + id}>
  <header><h2 id=${'h-' + id}>${name} <span class="count">${n}</span></h2></header>${n ? children : html`<p class="none">Nothing ${name.toLowerCase()}.</p>`}</section>`

// Landed per day as blue bars beside grey closed-without-landing bars; the phone draws narrower bars and every other day.
function Landed({ days, W, ph }) {
  const max = Math.max(4, ...days.map(d => d.ok + d.bad)), top = Math.ceil(max / 2) * 2, y = v => 158 - v / top * 140, band = (W - 28) / days.length, [lw, cw] = ph ? [8, 6] : [12, 8]
  return html`<svg viewBox=${`0 0 ${W} 184`} role="img" aria-label=${`${days[0].label} to today. Landed: ${days.map(d => d.ok).join(', ')}. Closed without landing: ${days.map(d => d.bad).join(', ')}.`}>
    ${[0, top / 2, top].map(v => html`<line x1="22" x2=${W - 6} y1=${y(v)} y2=${y(v)} stroke="var(--grid)"/><text x="16" y=${y(v) + 4} text-anchor="end">${v}</text>`)}
    ${days.map((d, k) => html`<g transform=${`translate(${22 + band * (k + .5) + 4} 0)`}>
      ${d.ok > 0 && html`<rect class="ld" x=${-lw} y=${y(d.ok)} width=${lw} height=${158 - y(d.ok)}/>`}${d.bad > 0 && html`<rect class="cl" x="1" y=${y(d.bad)} width=${cw} height=${158 - y(d.bad)}/>`}
      <text class="v" x=${-lw / 2} y=${y(d.ok) - 4}>${d.ok}</text>${(!ph || k % 2 === 0 || k === days.length - 1) && html`<text class=${k === days.length - 1 ? 'today' : ''} y="176">${new Date(d.t).getUTCDate()}</text>`}</g>`)}</svg>`
}

// Open and stuck lanes as step lines over the last 8 UTC days, against the plan (the fleet's lane caps).
function Lines({ hist, from, to, plan, W, ph }) {
  const max = Math.ceil(Math.max(6, plan, ...hist.map(h => h.lanes)) / 2) * 2, step = max <= 8 ? 2 : max / 4, x = t => 22 + (t - from) / (to - from) * (W - 48), y = v => 166 - v / max * 154
  const path = f => hist.map((h, k) => k ? `H${x(h.t)}V${y(f(h))}` : `M${x(h.t)} ${y(f(h))}`).join('') + `H${x(to)}`, end = hist.at(-1), peak = hist.reduce((a, h) => h.lanes > a.lanes ? h : a)
  return html`<svg viewBox=${`0 0 ${W} 190`} role="img" aria-label=${`Lanes over 8 days, ending open ${end.lanes}, stuck ${end.stuck}; plan ${plan}.`}>
    ${Array.from({ length: max / step + 1 }, (_, k) => k * step).map(v => html`<line x1="22" x2=${W - 26} y1=${y(v)} y2=${y(v)} stroke="var(--grid)"/><text x="16" y=${y(v) + 4} text-anchor="end">${v}</text>`)}
    <line x1="22" x2=${W - 26} y1=${y(plan)} y2=${y(plan)} stroke="var(--plan)" stroke-dasharray="4 3" stroke-width="1.5"/><text x="26" y=${y(plan) - 5}>plan ${plan}</text>
    <path d=${path(h => h.stuck)} fill="none" stroke="var(--s-line)" stroke-width="2"/><path d=${path(h => h.lanes)} fill="none" stroke="var(--ink)" stroke-width="2"/>
    ${peak.lanes > end.lanes && html`<text class="v" x=${x(peak.t)} y=${y(peak.lanes) - 5}>${peak.lanes}</text>`}
    <text class="v" x=${W - 21} y=${y(end.lanes) + 4}>${end.lanes}</text>${end.stuck !== end.lanes && html`<text class="v" x=${W - 21} y=${y(end.stuck) + 4}>${end.stuck}</text>`}
    ${Array.from({ length: 8 }, (_, k) => from + k * DAY).map((d, k) => (ph ? k % 2 === 0 || k === 7 : k !== 1) && html`<text x=${x(d)} y="184" class=${k === 7 ? 'today' : ''} text-anchor=${k ? 'middle' : 'start'}>${k ? new Date(d).getUTCDate() : new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</text>`)}</svg>`
}

export function Ops({ fleet }) {
  const { live, stuck, waiting, running } = answers(fleet), queued = live.filter(l => l.stage === 'queued').length, plan = slotsOf(fleet)
  const over = fleet.homes.map(h => [h, live.filter(l => l.home === h.id).length]).filter(([h, n]) => n > h.lane_cap)
  const to = Date.parse(fleet.generated_at), from = Math.floor(to / DAY) * DAY - 7 * DAY, days = mergeBuckets(fleet, '14d', to)
  // The newest sample of every 6 hours: an hourly step line over 8 days reads as noise.
  const hist = Object.values((fleet.history || []).map(h => ({ ...h, t: Date.parse(h.at) })).filter(h => h.t >= from && h.t <= to).sort((a, b) => a.t - b.t)
    .reduce((g, h) => ({ ...g, [Math.floor((h.t - from) / (6 * HOUR))]: h }), {})), end = hist.at(-1)
  return html`<div class="ops">
    <p class="sumline"><a href="#running"><b>${running.length}</b> running</a> · <a href="#waiting"><b>${waiting.length}</b> waiting on you</a> · <a href="#stuck"><b>${stuck.length}</b> stuck</a></p>
    <div class="strip"><span>Waiting on you<b>${waiting.length}</b></span><span>Stuck<b>${stuck.length}</b></span><span>Running<b>${running.length}</b></span><span>Queued<b>${queued}</b></span>
      ${over.length > 0 && html`<span class="end"><span class="badge b-s">Over plan</span>${over.map(([h, n]) => `${h.name} ${n} lanes, plan ${h.lane_cap}`).join(' · ')}</span>`}</div>
    <${Block} id="waiting" name="Waiting on you" n=${waiting.length}><${Rows} fleet=${fleet} lanes=${waiting} badge=${['b-q', 'Waiting']} note=${l => l.waiting_on && `Waiting on ${l.waiting_on}`}/><//>
    <${Block} id="stuck" name="Stuck" n=${stuck.length}><${Rows} fleet=${fleet} lanes=${stuck} badge=${['b-s', 'Stuck']}
      note=${l => fleet.incidents.find(i => i.lane === l.id && !i.resolved_at)?.summary || l.waiting_on && `Waiting on ${l.waiting_on}`}/><//>
    <${Block} id="running" name="Running" n=${running.length}><${Rows} fleet=${fleet} lanes=${running} badge=${['b-r']} act=${false}
      note=${l => fleet.workers.filter(w => w.lane === l.id && w.state === 'working').map(w => `${w.agent}, ${w.model}`).join(' · ')}/><//>
    <section class="block" id="pipeline" aria-labelledby="h-pipe"><header><h2 id="h-pipe">Pipeline <span class="count">${STAGES.length} stages</span></h2><a class="meta" href="#/lanes">Open the board</a></header>
      <p class="stagelinks">${STAGES.map(([k, name], i) => html`${i ? ' · ' : ''}<a href="#/lanes">${name} <b>${fleet.lanes.filter(l => l.stage === k).length}</b></a>`)}</p>
      <ol class="stages" aria-label="Stage counts">${STAGES.map(([k, name]) => { const n = fleet.lanes.filter(l => l.stage === k).length
        return html`<li key=${k} class=${n ? '' : 'zero'}><span>${name}</span><b>${n}</b></li>` })}</ol></section>
    <section class="block charts" aria-label="History">
      <figure class="fig"><h3>Landed per day, last 14 days</h3><div class="meta">${days.at(-1).ok} landed today, ${days.at(-2).ok} yesterday.</div>
        <div class="dk"><${Landed} days=${days} W=${458}/></div><div class="ph"><${Landed} days=${days} W=${326} ph/></div>
        <figcaption class="legend"><span><i class="sq" style="background:var(--blue)"></i>Landed</span><span><i class="sq" style="background:var(--closed)"></i>Closed without landing</span><span>${days.reduce((n, d) => n + d.ok, 0)} landed in 14 days</span></figcaption></figure>
      <figure class="fig"><h3>Open and stuck lanes, last 8 days</h3><div class="meta">${hist.length ? 'The newest sample of every 6 hours.' : 'This source sends no lane history.'}</div>
        ${hist.length > 1 && html`<div class="dk"><${Lines} hist=${hist} from=${from} to=${to} plan=${plan} W=${458}/></div><div class="ph"><${Lines} hist=${hist} from=${from} to=${to} plan=${plan} W=${326} ph/></div>
        <figcaption class="legend"><span><i></i>Open ${end.lanes}</span><span><i style="background:var(--s-line)"></i>Stuck ${end.stuck}</span><span><i class="dash"></i>Plan ${plan}</span></figcaption>`}</figure></section></div>`
}
