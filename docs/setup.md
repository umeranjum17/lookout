# Connect your fleet

Lookout reads one `lookout.fleet.v1` JSON document. An adapter is a script or service you write to produce that document from your fleet. Use a file that your script rewrites, or an HTTP(S) URL returning JSON. Lookout reads the source again on each refresh.

Start from the [complete sample document](../adapters/sample-fleet/fleet.json) and the [field-by-field contract](adapter.md). Supply hosts, supervised workspaces (`homes`), lanes, workers, quota windows, merges, releases and incidents. Optional history, devices and plans enable charts, device availability and release targets. Leave out optional data you do not know; Lookout identifies missing inputs rather than inventing values.

## Validate and serve

Save your document as `fleet.json` in the current directory, then run:

```sh
npx -y lookout-axi check --adapter ./fleet.json
npx -y lookout-axi serve --adapter ./fleet.json
```

A failed check lists the problems and exits 1. The server prints the URL to open and runs in the foreground until Ctrl-C.

## Commands and options

| Command | Purpose |
| --- | --- |
| `lookout serve` | Serve the bundled sample fleet. |
| `lookout check` | Validate the bundled sample fleet. |
| `lookout contract` | Print the adapter reference. |
| `lookout --version`, `lookout --help` | Print version or command help. |

Both `serve` and `check` accept `--adapter <path\|url>`. `serve` also accepts `--port 4390` and `--bind 127.0.0.1`; `--port 0` chooses a free port. Bind to a network address only when you intend to share fleet details.

The npm package exposes both `lookout` and `lookout-axi`. Use either after installing the package, or use `npx -y lookout-axi` without a global install. Node.js 20 or newer is required.

## Let your agent connect it

The [bundled agent skill](../skills/lookout-axi/SKILL.md) teaches an agent to produce, validate and serve a fleet adapter. Install it with:

```sh
npx skills add umeranjum17/lookout
```

Then ask: “Connect our fleet to Lookout.” You can also copy `skills/lookout-axi/` into your agent's skills folder. The skill uses the installed CLI's help for current commands and options.
