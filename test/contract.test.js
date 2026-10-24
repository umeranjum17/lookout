import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateFleet } from '../lib/contract.js'

const sample = () => JSON.parse(readFileSync(new URL('../adapters/sample-fleet/fleet.json', import.meta.url), 'utf8'))

test('the sample fleet satisfies the adapter contract', () => {
  assert.deepEqual(validateFleet(sample()), [])
})

test('a document breaking the contract is refused with the path of each problem', () => {
  const d = sample()
  d.schema = 'v0'
  delete d.hosts
  d.lanes[0].stage = 'sleeping'
  d.workers[0].lane = 'nope'
  d.homes[1].id = 'web'
  d.quota[0].used_pct = 140
  d.incidents[0].at = 'yesterday'
  d.merges[0].rework = -1
  d.merges[1].home = 'nope'
  d.lanes[1].waiting_on = ''
  const bad = validateFleet(d)
  for (const p of ['schema:', 'hosts: must be a list', 'lanes[0].stage', 'workers[0].lane: no lanes "nope"', 'homes[1].id: duplicate "web"', 'quota[0].used_pct', 'incidents[0].at', 'merges[0].rework', 'merges[1].home: no homes "nope"', 'lanes[1].waiting_on'])
    assert.ok(bad.some(b => b.startsWith(p)), `${p} missing from ${JSON.stringify(bad)}`)
})

test('empty lists and null runway are valid; a non-object is not', () => {
  const d = sample()
  for (const k of ['hosts', 'homes', 'lanes', 'workers', 'quota', 'merges', 'releases', 'incidents', 'devices', 'plans']) d[k] = []
  assert.deepEqual(validateFleet(d), [])
  assert.deepEqual(validateFleet([]), ['document: must be a JSON object'])
  assert.equal(sample().quota[3].runway_hours, null)
})

test('history is optional, and each sample needs a time and whole lane counts', () => {
  const d = sample()
  assert.ok(d.history.length >= 7 * 24, 'the sample carries 7 days of hourly samples')
  delete d.history
  assert.deepEqual(validateFleet(d), [])
  d.history = [{ at: '2026-10-24T12:00:00Z', lanes: 2.5, stuck: -1 }, { lanes: 1, stuck: 0 }]
  const bad = validateFleet(d)
  for (const p of ['history[0].lanes', 'history[0].stuck', 'history[1].at']) assert.ok(bad.some(b => b.startsWith(p)), `${p} missing from ${JSON.stringify(bad)}`)
})

test('a host gate, its jobs, the devices and the release plans are checked when sent', () => {
  const d = sample()
  d.hosts[0].gate = { state: 'ajar', limit_pct: 70 }
  d.hosts[1].jobs = [{ kind: 'gradle', running: -1 }]
  d.devices[0].lane = 'nope'
  d.devices[1].host = 'nowhere'
  d.plans[0].items = [{ title: 'Order export' }]
  d.plans[1].home = 'nope'
  const bad = validateFleet(d)
  for (const p of ['hosts[0].gate', 'hosts[1].jobs', 'devices[0].lane: no lanes "nope"', 'devices[1].host: no hosts "nowhere"', 'plans[0].items', 'plans[1].home: no homes "nope"']) assert.ok(bad.some(b => b.startsWith(p)), `${p} missing from ${JSON.stringify(bad)}`)
  delete d.devices
  delete d.plans
  delete d.hosts[0].gate
  delete d.hosts[1].jobs
  assert.deepEqual(validateFleet(d), [])
})
