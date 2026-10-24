import { html, back, hm, State } from './ui.js'

const HOUR = 3600e3
const span = h => h >= 48 ? `${Math.round(h / 24)}d` : hm(Math.max(0, h) * HOUR)
// A meter whose fill carries the severity; mark draws a limit line across it.
const Meter = ({ pct, label, tone = '', mark }) => html`<div class="bar" role="img" aria-label=${label}><i class=${tone} style=${{ width: `${Math.min(100, pct)}%` }}></i>
  ${mark != null && html`<b class="mark" style=${{ left: `${mark}%` }}></b>`}</div>`

// A quota window runs out when its runway ends before it resets; under an hour is urgent.
function outlook(q, now) {
  const reset = (Date.parse(q.resets_at) - now) / HOUR
  if (q.runway_hours == null) return { tone: q.used_pct >= 90 ? 'warn' : '', text: `no usage rate yet · resets in ${span(reset)}` }
  if (q.runway_hours >= reset) return { text: `lasts to its reset in ${span(reset)}` }
  return { tone: q.runway_hours < 1 ? 'bad' : 'warn', short: true, text: `runs out in ${span(q.runway_hours)}, ${span(reset - q.runway_hours)} before its reset` }
}

// How long the quota lasts and how loaded each host is, with its memory gate, heavy jobs and test devices.
export function Capacity({ fleet }) {
  const now = Date.parse(fleet.generated_at), rows = fleet.quota.map(q => ({ ...q, ...outlook(q, now) }))
  const first = rows.filter(q => q.short).sort((a, b) => a.runway_hours - b.runway_hours)[0]
  const providers = [...new Set(rows.map(q => q.provider))], devices = fleet.devices || []
  return html`<div class="g g-a top">
      <div class="card slots"><span class="lbl">Soonest run-out</span>
        <b class=${'big ' + (first?.tone || 'good')}>${first ? span(first.runway_hours) : 'none'}</b>
        <small>${first ? `${first.account} · ${first.provider} ${first.window} window, ${span((Date.parse(first.resets_at) - now) / HOUR - first.runway_hours)} before its reset`
          : 'every window lasts to its reset'}</small>
        <div class="homes">${providers.map(p => {
          const qs = rows.filter(q => q.provider === p), short = qs.filter(q => q.short).length
          return html`<div class="hm" key=${p}><span>${p}</span><span class="num">${(n => `${n} ${n === 1 ? 'account' : 'accounts'}`)(new Set(qs.map(q => q.account)).size)}</span>
            <small>${short ? `${short} ${short === 1 ? 'window runs' : 'windows run'} out before reset` : 'lasts to reset'}</small></div>`
        })}</div></div>
      <div class="card chart"><div class="ch"><b>Quota runway</b><small>used now, per account and window</small></div>
        ${providers.map(p => html`<div class="qg" key=${p}><h3>${p}</h3>${rows.filter(q => q.provider === p).map(q => html`<div class="qr" key=${q.account + q.window}>
          <span class="qn"><b>${q.account}</b> · ${q.window}</span><span class="num">${q.used_pct}% used</span>
          <${Meter} pct=${q.used_pct} tone=${q.tone} label=${`${q.account} ${q.window}: ${q.used_pct}% used, ${q.text}`}/><small class=${q.tone || ''}>${q.text}</small></div>`)}</div>`)}</div>
    </div>
    <h2 class="h2">Hosts</h2>
    <div class="g hosts">${fleet.hosts.map(h => html`<div class="card host" key=${h.id}>
      <div class="ch"><b>${h.name}</b>${h.gate && html`<span class="gate">Memory gate <${State} s=${h.gate.state}/></span>`}</div>
      <small>load ${h.load1} · sampled ${back(fleet, h.sampled_at)}</small>
      ${[['CPU', h.cpu_pct], ['Memory', h.mem_pct, h.gate?.limit_pct], ['Disk', h.disk_pct]].map(([k, v, mark]) => html`<div class="qr" key=${k}>
        <span class="qn">${k}</span><span class="num">${v}%${mark != null ? ` · gate at ${mark}%` : ''}</span>
        <${Meter} pct=${v} mark=${mark} tone=${mark != null && v >= mark ? 'warn' : ''} label=${`${h.name} ${k} ${v}%`}/></div>`)}
      ${(h.jobs || []).map(j => html`<div class="qr" key=${j.kind}><span class="qn">${j.kind[0].toUpperCase() + j.kind.slice(1)}</span>
        <span class="num">${j.running}${j.limit != null ? ` of ${j.limit}` : ''} running</span>
        ${j.limit != null && html`<${Meter} pct=${j.limit ? j.running / j.limit * 100 : 100} tone=${j.running >= j.limit ? 'warn' : ''} label=${`${h.name} ${j.kind}: ${j.running} of ${j.limit}`}/>`}</div>`)}
    </div>`)}</div>
    ${devices.length > 0 && html`<h2 class="h2">Devices</h2><div class="rows">${devices.map(d => {
      const lane = fleet.lanes.find(l => l.id === d.lane), body = html`<div class="t"><b>${d.name}</b><small>${d.kind} · ${fleet.hosts.find(h => h.id === d.host)?.name}${lane ? ` · ${lane.title}` : ''}</small></div>
        <${State} s=${d.state}/>${lane ? html`<span class="v">›</span>` : ''}`
      return lane ? html`<a class="row" key=${d.id} href=${`#/lane/${lane.id}`}>${body}</a>` : html`<div class="row" key=${d.id}>${body}</div>`
    })}</div>`}`
}
