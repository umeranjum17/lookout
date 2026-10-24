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
  const bad = validateFleet(d)
  for (const p of ['schema:', 'hosts: must be a list', 'lanes[0].stage', 'workers[0].lane: no lanes "nope"', 'homes[1].id: duplicate "web"', 'quota[0].used_pct', 'incidents[0].at'])
    assert.ok(bad.some(b => b.startsWith(p)), `${p} missing from ${JSON.stringify(bad)}`)
})

test('empty lists and null runway are valid; a non-object is not', () => {
  const d = sample()
  for (const k of ['hosts', 'homes', 'lanes', 'workers', 'quota', 'merges', 'releases', 'incidents']) d[k] = []
  assert.deepEqual(validateFleet(d), [])
  assert.deepEqual(validateFleet([]), ['document: must be a JSON object'])
  assert.equal(sample().quota[3].runway_hours, null)
})
