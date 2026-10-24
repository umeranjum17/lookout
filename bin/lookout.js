#!/usr/bin/env node
// The lookout CLI: serve the dashboard from an adapter, check an adapter's document, print the contract.
// Output is plain key: value lines, as the other AXI tools print, so an agent can read it.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp, version } from '../server.js'
import { loadFleet, SourceError } from '../lib/source.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const SAMPLE = resolve(root, 'adapters/sample-fleet/fleet.json')
const HELP = {
  '': `usage: lookout [command] [flags]
commands[4]:
  serve, check, contract, help
adapter: a file path or an http(s) URL that returns one lookout.fleet.v1 JSON document (see: lookout contract); with none, the bundled sample fleet
flags: --adapter on serve and check, --port and --bind on serve, --help on every command, -v/--version
examples:
  lookout serve
  lookout serve --adapter ./fleet.json --port 4390
  lookout serve --adapter http://127.0.0.1:8080/fleet.json --port 0
  lookout check --adapter ./fleet.json
  lookout contract`,
  serve: `usage: lookout serve [--adapter <path|url>] [--port 4390] [--bind 127.0.0.1]
Serves the dashboard in the foreground until Ctrl-C, reading the adapter again on every refresh; --port 0 picks a free port.
examples:
  lookout serve --adapter ./fleet.json --port 0`,
  check: `usage: lookout check [--adapter <path|url>]
Reads the adapter once and lists every way its document breaks the contract; exits 1 when it does.
examples:
  lookout check --adapter ./fleet.json`,
  contract: `usage: lookout contract
Prints the adapter contract: the lookout.fleet.v1 document shape an adapter must produce.`,
}

const fail = (message, hint = 'lookout --help') => { console.log(`error: ${message}\nhelp[1]:\n  Run \`${hint}\``); process.exit(2) }

function flags(args, allowed) {
  const out = {}
  for (let i = 0; i < args.length; i++) {
    const name = args[i].replace(/^--/, '')
    if (!args[i].startsWith('--') || !allowed.includes(name)) fail(`unknown argument ${args[i]}`)
    if (args[i + 1] === undefined || args[i + 1].startsWith('--')) fail(`--${name} needs a value`)
    out[name] = args[++i]
  }
  return out
}
const adapterOf = f => f.adapter === undefined ? SAMPLE : /^https?:\/\//.test(f.adapter) ? f.adapter : resolve(f.adapter)

const [cmd = '', ...rest] = process.argv.slice(2)
if (cmd === '-v' || cmd === '--version') console.log(version)
else if (cmd === '' || cmd === 'help' || cmd === '--help' || cmd === '-h') console.log(`version: ${version}\n${HELP['']}`)
else if (!(cmd in HELP)) fail(`unknown command ${cmd}`)
else if (rest.includes('--help') || rest.includes('-h')) console.log(HELP[cmd])
else if (cmd === 'contract') { flags(rest, []); console.log(await readFile(resolve(root, 'docs/adapter.md'), 'utf8')) }
else if (cmd === 'check') {
  const adapter = adapterOf(flags(rest, ['adapter']))
  try {
    const fleet = await loadFleet(adapter)
    console.log(`adapter: ${adapter}\nresult: valid\nfleet: ${fleet.name}\ncounts: ${['hosts', 'homes', 'lanes', 'workers', 'merges', 'incidents'].map(k => `${fleet[k].length} ${k}`).join(', ')}`)
  } catch (e) {
    if (!(e instanceof SourceError)) throw e
    console.log(`adapter: ${adapter}\nresult: invalid\nerror: ${e.message}${e.problems.length ? `\nproblems[${e.problems.length}]:\n${e.problems.map(p => `  ${p}`).join('\n')}` : ''}`)
    process.exit(1)
  }
} else {
  const f = flags(rest, ['adapter', 'port', 'bind']), adapter = adapterOf(f), bind = f.bind || '127.0.0.1', port = Number(f.port ?? 4390)
  if (!Number.isInteger(port) || port < 0 || port > 65535) fail(`--port must be a number from 0 to 65535, not ${f.port}`, 'lookout serve --help')
  const server = createApp(adapter)
  server.on('error', e => fail(`cannot listen on ${bind}:${port}: ${e.code || e.message}`, 'lookout serve --help'))
  server.listen(port, bind, () => console.log(`lookout: serving\nurl: http://${bind}:${server.address().port}\nadapter: ${adapter}${adapter === SAMPLE ? ' (the bundled sample fleet)' : ''}\nversion: ${version}\nhelp[1]:\n  Stop it with Ctrl-C`))
}
