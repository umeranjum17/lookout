import test from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../server.js'

const SAMPLE = new URL('../adapters/sample-fleet/fleet.json', import.meta.url).pathname
const serve = async source => {
  const server = createApp(source)
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }
}

test('the server hands the app and the sample fleet with the package version', async () => {
  const s = await serve(SAMPLE)
  try {
    const api = await (await fetch(`${s.base}/api/fleet`)).json()
    assert.equal(api.version, JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version)
    assert.equal(api.fleet.name, 'Sample fleet')
    const page = await fetch(`${s.base}/`)
    assert.equal(page.status, 200)
    assert.match(await page.text(), /<title>Lookout<\/title>/)
    assert.equal((await fetch(`${s.base}/app.js`)).status, 200)
    for (const [icon, type] of [['favicon.svg', 'image/svg+xml'], ['icon.svg', 'image/svg+xml'], ['icon-32.png', 'image/png'], ['icon-180.png', 'image/png']]) {
      const res = await fetch(`${s.base}/${icon}`)
      assert.equal(res.status, 200, icon)
      assert.equal(res.headers.get('content-type'), type, icon)
    }
  } finally { s.close() }
})

test('the source is read again on every request, and a broken one is reported with its problems', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'lookout-')), 'fleet.json')
  const doc = JSON.parse(readFileSync(SAMPLE, 'utf8'))
  writeFileSync(file, JSON.stringify(doc))
  const s = await serve(file)
  try {
    assert.equal((await fetch(`${s.base}/api/fleet`)).status, 200)
    doc.name = 'Renamed'; doc.lanes[0].stage = 'sleeping'
    writeFileSync(file, JSON.stringify(doc))
    const res = await fetch(`${s.base}/api/fleet`)
    assert.equal(res.status, 502)
    const body = await res.json()
    assert.match(body.error, /breaks the adapter contract/)
    assert.ok(body.problems.some(p => p.startsWith('lanes[0].stage')))
    writeFileSync(file, 'not json')
    assert.match((await (await fetch(`${s.base}/api/fleet`)).json()).error, /is not JSON/)
  } finally { s.close() }
})

test('the server is read-only and stays inside the app folder', async () => {
  const s = await serve(SAMPLE)
  try {
    assert.equal((await fetch(`${s.base}/api/fleet`, { method: 'POST' })).status, 405)
    assert.equal((await fetch(`${s.base}/%2e%2e/package.json`)).status, 404)
    assert.equal((await fetch(`${s.base}/missing.js`)).status, 404)
  } finally { s.close() }
})
