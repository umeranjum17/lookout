# Adapter interface

Lookout shows whatever an adapter hands it. An adapter is anything that produces one JSON document in the `lookout.fleet.v1` shape below: a file on disk, a URL, or the output of a script. Lookout never reads your agent tools directly, so pointing it at your own fleet means writing (or generating) that one document.

Times are ISO 8601 UTC strings. Percentages are numbers from 0 to 100. Ids are non-empty strings, unique within their list. Every list may be empty; every list key must be present.

## Document

| Key | Type | Meaning |
| --- | --- | --- |
| `schema` | `"lookout.fleet.v1"` | The shape version. |
| `generated_at` | time | When the adapter built this document. |
| `name` | string | Fleet name shown in the header. |
| `hosts` | host[] | Machines the fleet runs on, with load. |
| `homes` | home[] | Supervised workspaces, each with its lane cap and supervision health. |
| `lanes` | lane[] | Units of work, each owned by a home. |
| `workers` | worker[] | Agents doing the work, each on a lane. |
| `quota` | quota[] | Usage windows per account. |
| `merges` | merge[] | Recent merge events. |
| `releases` | release[] | Recent releases. |
| `incidents` | incident[] | Things that went wrong. |

### host

`id`, `name`, `cpu_pct`, `mem_pct`, `disk_pct`, `load1` (number), `sampled_at` (time).

### home

`id`, `name`, `host` (a host id), `lane_cap` (integer, at least 1), `supervision`: `{ state: "ok" | "stale" | "down", last_beat_at: time, note?: string }`.

### lane

`id`, `home` (a home id), `title`, `project`, `stage` (`queued` | `working` | `review` | `merging` | `done`), `stuck` (boolean), `started_at` (time), `updated_at` (time), optional `pr_url` (string).

### worker

`id`, `lane` (a lane id), `agent` (string, for example `claude`), `model` (string), `account` (string), `state` (`working` | `idle` | `waiting` | `exited`), `started_at` (time), `last_activity_at` (time).

### quota

`account`, `provider`, `window` (string, for example `5h` or `week`), `used_pct`, `resets_at` (time), `runway_hours` (number or `null` when unknown).

### merge

`at` (time), `repo`, `title`, `outcome` (`merged` | `failed` | `reverted`), `checks` (`pass` | `fail`), optional `lane` (a lane id), optional `pr_url`.

### release

`repo`, `version`, `at` (time), `channel` (string), `status` (`shipped` | `pending` | `failed`).

### incident

`id`, `at` (time), `severity` (`info` | `warn` | `crit`), `summary`, optional `home` (a home id), optional `lane` (a lane id), optional `resolved_at` (time).

## References

`home.host`, `lane.home`, `worker.lane`, `merge.lane` and `incident.home`/`incident.lane` must name an existing id in the same document.

## Sources

A source is where Lookout gets the document: a file path or an `http(s)` URL (the file or URL is read again on every refresh). The checker in `lib/contract.js` (`validateFleet`) returns the list of problems, each as `path: message`; an empty list means the document is valid. `adapters/sample-fleet/fleet.json` is a complete example.

Vendor-specific adapters live outside this repository and feed the file or URL source; this repository carries no vendor names or paths.
