#!/usr/bin/env node
// Serves the app and the fleet document from one source: node server.js [--source <file|url>] [--port N] [--bind ADDR]
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadFleet, SourceError } from './lib/source.js'

const root = fileURLToPath(new URL('.', import.meta.url))
const appDir = join(root, 'app')
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' }
const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version
const HEADERS = { 'content-security-policy': "default-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'", 'x-content-type-options': 'nosniff' }

export function createApp(source) {
  return createServer(async (req, res) => {
    const send = (code, type, body) => { res.writeHead(code, { ...HEADERS, 'content-type': type, 'cache-control': 'no-store' }); res.end(body) }
    const url = new URL(req.url, 'http://x')
    if (req.method !== 'GET') return send(405, 'text/plain', 'read-only')
    if (url.pathname === '/api/fleet') {
      try { return send(200, TYPES['.json'], JSON.stringify({ version, fleet: await loadFleet(source) })) }
      catch (e) {
        if (!(e instanceof SourceError)) throw e
        return send(502, TYPES['.json'], JSON.stringify({ version, error: e.message, problems: e.problems.slice(0, 20) }))
      }
    }
    const file = normalize(join(appDir, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)))
    if (file !== appDir && !file.startsWith(appDir + sep)) return send(404, 'text/plain', 'not found')
    try { send(200, TYPES[extname(file)] || 'application/octet-stream', await readFile(file)) }
    catch { send(404, 'text/plain', 'not found') }
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt }
  const source = arg('--source', join(root, 'adapters/sample-fleet/fleet.json')), port = Number(arg('--port', 4390)), bind = arg('--bind', '127.0.0.1')
  createApp(source).listen(port, bind, () => console.log(`lookout ${version} on http://${bind}:${port} reading ${source}`))
}
