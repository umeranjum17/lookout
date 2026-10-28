import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BIN = new URL('../bin/lookout.js', import.meta.url).pathname
const SAMPLE = new URL('../adapters/sample-fleet/fleet.json', import.meta.url).pathname
const run = (...args) => spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' })
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
const sample = () => JSON.parse(readFileSync(SAMPLE, 'utf8'))
const adapterFile = doc => {
  const file = join(mkdtempSync(join(tmpdir(), 'lookout-')), 'fleet.json')
  writeFileSync(file, typeof doc === 'string' ? doc : JSON.stringify(doc))
  return file
}

test('the lookout command prints its version, help and the contract', () => {
  assert.equal(run('--version').stdout.trim(), version)
  assert.match(run().stdout, new RegExp(`^version: ${version}\\nusage: lookout`))
  assert.match(run('serve', '--help').stdout, /^usage: lookout serve/)
  assert.match(run('contract').stdout, /lookout\.fleet\.v1/)
  const bad = run('launch')
  assert.equal(bad.status, 2)
  assert.match(bad.stdout, /^error: unknown command launch/)
})

test('check passes the sample fleet and lists every problem of a broken adapter', () => {
  assert.match(run('check').stdout, /result: valid/)

  const d = sample()
  d.schema = 'v0'
  d.lanes[0].stage = 'sleeping'
  d.lanes[1].waiting_on = ''
  d.workers[0].lane = 'nope'
  d.homes[1].id = 'web'
  d.quota[0].used_pct = 140
  d.incidents[0].at = 'yesterday'
  d.merges[0].rework = -1
  d.merges[1].home = 'nope'
  d.history = [{ at: '2026-10-24T12:00:00Z', lanes: 2.5, stuck: -1 }, { lanes: 1, stuck: 0 }]
  d.devices[0].lane = 'nope'
  d.devices[1].host = 'nowhere'
  const h = sample()
  h.hosts[0].gate = { state: 'ajar', limit_pct: 70 }
  h.hosts[1].jobs = [{ kind: 'gradle', running: -1 }]
  d.plans[1].home = 'nope'
  d.plans[0].items = [{ title: 'Order export' }]
  delete d.hosts
  const out = run('check', '--adapter', adapterFile(d))
  assert.equal(out.status, 1)
  assert.match(out.stdout, /result: invalid/)
  for (const p of ['schema:', 'hosts: must be a list', 'lanes[0].stage', 'lanes[1].waiting_on', 'workers[0].lane: no lanes "nope"', 'homes[1].id: duplicate "web"', 'quota[0].used_pct', 'incidents[0].at', 'merges[0].rework', 'merges[1].home: no homes "nope"', 'history[0].lanes', 'history[0].stuck', 'history[1].at', 'devices[0].lane: no lanes "nope"', 'devices[1].host: no hosts "nowhere"', 'plans[0].items', 'plans[1].home: no homes "nope"'])
    assert.ok(out.stdout.includes(`  ${p}`), `${p} missing from ${out.stdout}`)

  const hout = run('check', '--adapter', adapterFile(h)).stdout
  for (const p of ['hosts[0].gate', 'hosts[1].jobs']) assert.ok(hout.includes(`  ${p}`), `${p} missing from ${hout}`)

  // a minimal document is valid: empty lists, no history, no optional host fields
  for (const k of ['hosts', 'homes', 'lanes', 'workers', 'quota', 'merges', 'releases', 'incidents', 'devices', 'plans']) d[k] = []
  delete d.history
  d.schema = sample().schema
  assert.match(run('check', '--adapter', adapterFile(d)).stdout, /result: valid/)
  assert.equal(run('check', '--adapter', adapterFile([])).status, 1)
})

test('serve runs the dashboard from an adapter, rereads it on every request and stays read-only', async () => {
  const doc = sample()
  const file = adapterFile(doc)
  const child = spawn(process.execPath, [BIN, 'serve', '--adapter', file, '--port', '0'], { stdio: ['ignore', 'pipe', 'inherit'] })
  try {
    const url = await new Promise((ok, no) => {
      let out = ''
      child.stdout.on('data', d => { out += d; const m = out.match(/^url: (\S+)$/m); if (m) ok(m[1]) })
      child.on('exit', code => no(new Error(`serve exited ${code}: ${out}`)))
    })
    const api = await (await fetch(`${url}/api/fleet`)).json()
    assert.equal(api.version, version)
    assert.equal(api.fleet.schema, 'lookout.fleet.v1')
    assert.equal(api.fleet.name, doc.name)
    assert.match(await (await fetch(url)).text(), /<title>Lookout<\/title>/)
    assert.equal((await fetch(`${url}/app.js`)).status, 200)
    for (const [icon, type] of [['favicon.svg', 'image/svg+xml'], ['icon-32.png', 'image/png'], ['icon-180.png', 'image/png']]) {
      const res = await fetch(`${url}/${icon}`)
      assert.equal(res.status, 200, icon)
      assert.equal(res.headers.get('content-type'), type, icon)
    }

    assert.equal((await fetch(`${url}/api/fleet`, { method: 'POST' })).status, 405)
    assert.equal((await fetch(`${url}/%2e%2e/package.json`)).status, 404)
    assert.equal((await fetch(`${url}/missing.js`)).status, 404)

    doc.name = 'Renamed'
    writeFileSync(file, JSON.stringify(doc))
    assert.equal((await (await fetch(`${url}/api/fleet`)).json()).fleet.name, 'Renamed')
    doc.lanes[0].stage = 'sleeping'
    writeFileSync(file, JSON.stringify(doc))
    const res = await fetch(`${url}/api/fleet`)
    assert.equal(res.status, 502)
    const body = await res.json()
    assert.match(body.error, /breaks the adapter contract/)
    assert.ok(body.problems.some(p => p.startsWith('lanes[0].stage')))
    writeFileSync(file, 'not json')
    assert.match((await (await fetch(`${url}/api/fleet`)).json()).error, /is not JSON/)
  } finally { child.kill() }
})
