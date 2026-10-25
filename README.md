<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/lookout-logo-dark.svg">
  <img src="docs/images/lookout-logo.svg" width="96" height="96" alt="Lookout observation tower">
</picture>
<h1>Lookout</h1>

**Know which coding agents need you before work stalls.**

A read-only fleet dashboard for people running agents across workspaces, accounts and hosts.

<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="docs/images/hero-phone-dark.webp">
  <source media="(max-width: 600px)" srcset="docs/images/hero-phone-light.webp">
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/hero-dark.webp">
  <img src="docs/images/hero-light.webp" width="880" alt="Lookout Overview of a live fleet: lanes in use across homes beside a 24-hour history chart">
</picture>

[Quick start](#quick-start) · [Connect your fleet](docs/setup.md) · [Adapter reference](docs/adapter.md) · [Agent skill](skills/lookout-axi/SKILL.md)

[![npm version](https://img.shields.io/npm/v/lookout-axi)](https://www.npmjs.com/package/lookout-axi) [![CI](https://github.com/umeranjum17/lookout/actions/workflows/ci.yml/badge.svg)](https://github.com/umeranjum17/lookout/actions/workflows/ci.yml)

</div>

## Quick start

Requires Node.js 20 or newer. Run these three commands in a terminal:

```sh
npx -y lookout-axi --version
npx -y lookout-axi check
npx -y lookout-axi serve
```

Open **http://127.0.0.1:4390**. You start with the bundled sample fleet; stop the server with Ctrl-C. No account or fleet connection is needed to explore it. The hero above is a live fleet Overview with real lane history.

To show your own work, [produce a fleet JSON document](docs/setup.md) and run `npx -y lookout-axi serve --adapter ./fleet.json`.

## Why Lookout

- **Who needs me?** Lookout: lanes by stage, workers and stuck work (instead of opening each workspace).
- **Will capacity last?** Lookout: quota runway, CPU, memory and disk together (instead of checking accounts and hosts separately).
- **Why is nothing shipping?** Lookout: merge time, waiting reasons and releases across the fleet (instead of reconstructing merges and failures by hand).

Lookout reads one JSON document from a file or URL and refreshes every 30 seconds. Your adapter decides where the data comes from. The dashboard sends no commands to your agents.

## What you get

- **Find the work that needs a hand** — Lanes move from queued to done, with a detail page for each lane and filters by workspace.
- **See what limits the fleet** — Capacity brings account quota, host load, memory gates, heavy jobs and test devices together.
- **Understand the path to merge** — Flow shows median and p90 merge time, first-pass rate and reasons work is waiting.
- **Track trouble and releases** — Incidents show severity and resolution; releases compare what is live with what is in development.

<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="docs/images/flow-phone-dark.webp">
  <source media="(max-width: 600px)" srcset="docs/images/flow-phone-light.webp">
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/flow-dark.webp">
  <img src="docs/images/flow-light.webp" width="880" alt="Sample fleet Flow: time to merge, merges per day, first-pass rate and why work waits">
</picture>

<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="docs/images/capacity-phone-dark.webp">
  <source media="(max-width: 600px)" srcset="docs/images/capacity-phone-light.webp">
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/capacity-dark.webp">
  <img src="docs/images/capacity-light.webp" width="880" alt="Sample fleet Capacity: quota runway, soonest run-out and host memory gates">
</picture>

## Try it, inspect it, verify it

The hero shows a **live fleet** Overview (real lane history and home load). The Flow and Capacity frames below use the [bundled sample adapter](adapters/sample-fleet/fleet.json) from the [published npm package](https://www.npmjs.com/package/lookout-axi), so you can run the same dashboard yourself.

- [Integration checks](test/) exercise the adapter contract, CLI and HTTP server; [CI runs them on every pull request](https://github.com/umeranjum17/lookout/actions/workflows/ci.yml).
- [The adapter contract](docs/adapter.md) documents the inputs behind the charts. Missing inputs are identified rather than guessed.
- The dashboard ships its font and UI library locally and has no runtime package dependencies.

## Local and read-only

The server binds to `127.0.0.1` and only accepts GET requests. It reads your adapter and writes nothing to your fleet. Pass `--bind` only when you intend to share the dashboard: the document can name hosts, accounts and work.

Lookout displays the data your adapter provides; it does not discover agents or calculate quota runway for you. See [adapter setup and CLI options](docs/setup.md) for file and URL sources, validation, and the bundled agent skill.

## Develop

```sh
npm test
npm pack --dry-run
npm start
```

Plain JavaScript modules, no build step. See [the adapter reference](docs/adapter.md) to add a data source.

[MIT license](LICENSE).
