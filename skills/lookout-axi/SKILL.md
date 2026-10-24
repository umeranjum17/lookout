---
name: lookout-axi
description: "Show the user their agent fleet on a local dashboard (lanes and workers, supervision health, quota runway, merge flow, host load, incidents and releases) with the lookout-axi CLI, and point it at a fleet by writing an adapter that produces one JSON document. Use when the user wants to see or watch what their agents are doing, wants an ops view of an agent fleet, or asks to connect their own fleet, tool or data to Lookout."
license: MIT
metadata:
  author: umeranjum17
  hermes:
    tags:
      - observability
      - dashboard
      - agents
      - fleet
      - cli
    category: productivity
---

# lookout-axi

Lookout is a read-only dashboard for an agent fleet. It never reads your agent tools itself: it reads one JSON document in the `lookout.fleet.v1` shape from an **adapter**, a file path or an http(s) URL, again on every refresh. Pointing Lookout at a fleet means producing that document.

## Current guidance lives in the CLI

Do not trust this file for commands, flags or output; installed copies go stale. Ask the CLI:

- `npx -y lookout-axi --help` for commands and examples
- `npx -y lookout-axi <command> --help` for one command's flags
- `npx -y lookout-axi contract` for the document shape, field by field

You do not need it installed globally. If its output shows a command starting with `lookout`, run it as `npx -y lookout-axi ...`.

## Point Lookout at a fleet

1. Read the contract (`npx -y lookout-axi contract`). Every list key must be present and may be empty, except the optional ones it names. Times are ISO 8601 UTC; ids are unique within their list; references (a lane's `home`, a worker's `lane`) must name an id in the same document.
2. Write the adapter: a script or service that reads the fleet's own state and writes the document to a file, or serves it at a URL. Map only what the fleet really knows; leave an optional field out rather than invent it. Lookout says on each screen what the source does not send.
3. Check it: `npx -y lookout-axi check --adapter <path|url>`. It prints `result: valid`, or `result: invalid` with each problem as `path: message`, and exits 1. Fix every problem before serving.
4. Serve it: `npx -y lookout-axi serve --adapter <path|url> --port 0` runs in the foreground and prints the `url:` to open. Keep the adapter refreshing the file or URL; the dashboard reads it again every 30 seconds.
5. Stop the server you started with Ctrl-C, or end that one process by the PID you started. Never stop a process you did not start.

With no `--adapter`, Lookout serves its bundled sample fleet, which is a complete example document to copy from.

## Rules

- Lookout is read-only: it changes nothing in the fleet, and its server answers only GET.
- It binds to 127.0.0.1 by default. Pass `--bind` to share it on a network only when the user asks; the fleet document can name hosts, accounts and work.
- Tests and demos use the sample fleet or a document in a temporary folder, never the user's live fleet unless they asked.
