// Hand-drawn SVG charts for Overview. Each chart measures its own width so text keeps its size on every screen,
// and every value it draws is also in its aria-label.
import { html } from './ui.js'
import { useState, useRef, useLayoutEffect } from './vendor/preact-htm-3.1.1.js'

const H = 200, L = 28, R = 12, T = 20, B = 24

function useWidth() {
  const ref = useRef(), [w, setW] = useState(0)
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(ref.current); return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// The pointer (or arrow keys) picks the nearest index; the tooltip shows it.
function usePick(n, at) {
  const [i, setI] = useState(null)
  return [i, {
    tabindex: 0, onPointerLeave: () => setI(null), onBlur: () => setI(null),
    onPointerMove: e => { const r = e.currentTarget.getBoundingClientRect(); setI(at(e.clientX - r.left)) },
    onKeyDown: e => { const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key]; if (d) { e.preventDefault(); setI(Math.max(0, Math.min(n - 1, (i ?? n) + d))) } },
  }]
}

const Tip = ({ x, w, value, label }) => html`<div class="tip" style=${{ left: `${Math.max(56, Math.min(w - 56, x))}px` }}><b class="num">${value}</b><span>${label}</span></div>`
const yTicks = max => { const s = max <= 8 ? 2 : Math.ceil(max / 4); return Array.from({ length: Math.floor(max / s) + 1 }, (_, k) => k * s) }

// A level over time against a cap: points [{ t, v, label }], ticks [{ t, label }].
export function Line({ points, from, to, max, cap, ticks, label, tip }) {
  const [ref, w] = useWidth(), x = t => L + (t - from) / (to - from) * (w - L - R), y = v => T + (1 - v / max) * (H - T - B)
  const near = px => points.reduce((b, p, k) => Math.abs(x(p.t) - px) < Math.abs(x(points[b].t) - px) ? k : b, 0)
  const [i, on] = usePick(points.length, near), p = points[i], end = points.at(-1)
  const d = points.map((q, k) => `${k ? 'L' : 'M'}${x(q.t).toFixed(1)},${y(q.v).toFixed(1)}`).join('')
  return html`<div class="plot" ref=${ref}>${w > 0 && html`<svg width=${w} height=${H} role="img" aria-label=${label} ...${on}>
      ${yTicks(max).map(v => html`<g key=${v}><line class="grid" x1=${L} x2=${w - R} y1=${y(v)} y2=${y(v)}/><text class="ax" x=${L - 8} y=${y(v) + 4} text-anchor="end">${v}</text></g>`)}
      ${cap && html`<line class="cap" x1=${L} x2=${w - R} y1=${y(cap)} y2=${y(cap)}/><text class="ax" x=${w - R} y=${y(cap) - 6} text-anchor="end">${cap} slots</text>`}
      ${ticks.map(k => html`<text class="ax" key=${k.t} x=${x(k.t)} y=${H - 6} text-anchor=${k.t === from ? 'start' : k.t === to ? 'end' : 'middle'}>${k.label}</text>`)}
      <path class="area" d=${`${d}L${x(end.t)},${y(0)}L${x(points[0].t)},${y(0)}Z`}/><path class="ln" d=${d}/>
      ${p && html`<line class="hair" x1=${x(p.t)} x2=${x(p.t)} y1=${T} y2=${y(0)}/>`}
      <circle class="dot" cx=${x((p || end).t)} cy=${y((p || end).v)} r="4"/>
    </svg>`}${p && html`<${Tip} x=${x(p.t)} w=${w} value=${tip(p)} label=${p.label}/>`}</div>`
}

// Stacked columns, one per bucket: buckets [{ ok, bad, label, tick? }]. ok sits on the baseline, bad on top of it.
export function Bars({ buckets, label, tip }) {
  const [ref, w] = useWidth(), n = buckets.length, band = (w - L - R) / n, bw = Math.min(24, band * .6)
  const max = Math.max(4, ...buckets.map(b => b.ok + b.bad)), y = v => T + (1 - v / max) * (H - T - B), cx = k => L + band * (k + .5)
  const [i, on] = usePick(n, px => Math.max(0, Math.min(n - 1, Math.floor((px - L) / band))))
  const col = (k, v0, v1, round) => { const x0 = cx(k) - bw / 2, t = y(v1), b = y(v0) - (v0 ? 2 : 0), r = round ? Math.min(4, b - t) : 0
    return b - t < 1 ? '' : `M${x0},${b}V${t + r}Q${x0},${t} ${x0 + r},${t}H${x0 + bw - r}Q${x0 + bw},${t} ${x0 + bw},${t + r}V${b}Z` }
  return html`<div class="plot" ref=${ref}>${w > 0 && html`<svg width=${w} height=${H} role="img" aria-label=${label} ...${on}>
      ${yTicks(max).map(v => html`<g key=${v}><line class="grid" x1=${L} x2=${w - R} y1=${y(v)} y2=${y(v)}/><text class="ax" x=${L - 8} y=${y(v) + 4} text-anchor="end">${v}</text></g>`)}
      ${buckets.map((b, k) => html`<g key=${k} class=${i === k ? 'on' : ''}>
        <path class="ok" d=${col(k, 0, b.ok, !b.bad)}/><path class="bad" d=${col(k, b.ok, b.ok + b.bad, true)}/>
        ${b.ok + b.bad > 0 && html`<text class="val" x=${cx(k)} y=${y(b.ok + b.bad) - 6} text-anchor="middle">${b.ok + b.bad}</text>`}
        ${b.tick && html`<text class="ax" x=${cx(k)} y=${H - 6} text-anchor=${k === 0 && n > 12 ? 'start' : k === n - 1 && n > 12 ? 'end' : 'middle'}>${b.tick}</text>`}</g>`)}
    </svg>`}${i != null && html`<${Tip} x=${cx(i)} w=${w} value=${tip(buckets[i])} label=${buckets[i].label}/>`}</div>`
}

// A small trend line with its latest point marked.
export function Spark({ values, label }) {
  const [ref, w] = useWidth(), h = 48, max = Math.max(1, ...values), x = k => 4 + k / Math.max(1, values.length - 1) * (w - 8), y = v => 4 + (1 - v / max) * (h - 8)
  return html`<div class="spark" ref=${ref}>${w > 0 && html`<svg width=${w} height=${h} role="img" aria-label=${label}>
    <path class="sl" d=${values.map((v, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join('')}/>
    <circle class=${'dot' + (values.at(-1) ? ' hot' : '')} cx=${x(values.length - 1)} cy=${y(values.at(-1))} r="4"/></svg>`}</div>`
}
