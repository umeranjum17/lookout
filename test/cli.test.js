import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BIN = new URL('../bin/lookout.js', import.meta.url).pathname
const run = (...args) => spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' })
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))

test('the lookout command prints its version, help and the contract', () => {
  assert.equal(run('--version').stdout.trim(), version)
  assert.match(run().stdout, new RegExp(`^version: ${version}\\nusage: lookout`))
  assert.match(run('serve', '--help').stdout, /^usage: lookout serve/)
  assert.match(run('contract').stdout, /lookout\.fleet\.v1/)
  const bad = run('launch')
  assert.equal(bad.status, 2)
  assert.match(bad.stdout, /^error: unknown command launch/)
})

test('check passes the sample fleet and lists each problem of a broken adapter', () => {
  assert.match(run('check').stdout, /result: valid/)
  const file = join(mkdtempSync(join(tmpdir(), 'lookout-')), 'fleet.json')
  const doc = JSON.parse(readFileSync(new URL('../adapters/sample-fleet/fleet.json', import.meta.url)))
  doc.lanes[0].stage = 'sleeping'
  writeFileSync(file, JSON.stringify(doc))
  const out = run('check', '--adapter', file)
  assert.equal(out.status, 1)
  assert.match(out.stdout, /result: invalid\n.*\nproblems\[1\]:\n {2}lanes\[0\]\.stage: invalid/)
})

test('serve runs the dashboard from an adapter on a free port', async () => {
  const child = spawn(process.execPath, [BIN, 'serve', '--port', '0'], { stdio: ['ignore', 'pipe', 'inherit'] })
  try {
    const url = await new Promise((ok, no) => {
      let out = ''
      child.stdout.on('data', d => { out += d; const m = out.match(/^url: (\S+)$/m); if (m) ok(m[1]) })
      child.on('exit', code => no(new Error(`serve exited ${code}: ${out}`)))
    })
    const api = await (await fetch(`${url}/api/fleet`)).json()
    assert.equal(api.version, version)
    assert.equal(api.fleet.schema, 'lookout.fleet.v1')
    assert.match(await (await fetch(url)).text(), /<title>Lookout<\/title>/)
  } finally { child.kill() }
})
