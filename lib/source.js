// A source is where the fleet document comes from: a file path or an http(s) URL, read again on every call.
import { readFile } from 'node:fs/promises'
import { validateFleet } from './contract.js'

export class SourceError extends Error {
  constructor(message, problems = []) { super(message); this.problems = problems }
}

export async function loadFleet(source) {
  let text
  try {
    if (/^https?:\/\//.test(source)) {
      const res = await fetch(source, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      text = await res.text()
    } else text = await readFile(source, 'utf8')
  } catch (e) { throw new SourceError(`cannot read ${source}: ${e.message}`) }
  let doc
  try { doc = JSON.parse(text) } catch (e) { throw new SourceError(`${source} is not JSON: ${e.message}`) }
  const problems = validateFleet(doc)
  if (problems.length) throw new SourceError(`${source} breaks the adapter contract (${problems.length} problems)`, problems)
  return doc
}
