import { Schema } from 'effect'

import enableText from '../../data/enable/enable1.txt?raw'
import scheduleText from '../../data/schedule.json?raw'
import { utcDateOf } from '../game/day.ts'
import { Puzzle } from '../game/puzzle.ts'
import { ScheduleJson } from '../generator/schedule.ts'
import { DICTIONARY_VERSION, parseEnable } from '../generator/dictionary.ts'
import { Lookup, puzzleFor } from './puzzles.ts'

type Env = Readonly<{ ASSETS: Fetcher }>

const PUZZLE_ROUTE = /^\/api\/puzzle\/([^/]+)$/

const schedule = Schema.decodeUnknownSync(ScheduleJson)(scheduleText)

const encodePuzzle = Schema.encodeSync(Schema.fromJsonString(Puzzle))

const dictionary = parseEnable(enableText)

const json = (body: string, status: number, cacheControl: string): Response =>
  new Response(body, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
      'x-content-type-options': 'nosniff',
    },
  })

const error = (status: number, message: string): Response =>
  json(JSON.stringify({ error: message }), status, 'no-store')

const servePuzzle = (date: string): Response =>
  Lookup.$match(
    puzzleFor(
      schedule,
      dictionary,
      DICTIONARY_VERSION,
      date,
      utcDateOf(Date.now()),
    ),
    {
      Found: ({ puzzle }) =>
        json(encodePuzzle(puzzle), 200, 'public, max-age=86400'),
      InvalidDate: () => error(400, 'Dates look like 2026-10-30.'),
      NotYet: () => error(404, 'That puzzle has not been released yet.'),
      Unscheduled: () => error(404, 'No puzzle is scheduled for that day.'),
    },
  )

export default {
  fetch: (request: Request, env: Env): Promise<Response> | Response => {
    const match = PUZZLE_ROUTE.exec(new URL(request.url).pathname)

    if (match === null) {
      return env.ASSETS.fetch(request)
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return error(405, 'Only GET is supported.')
    }

    return servePuzzle(decodeURIComponent(match[1] ?? ''))
  },
} satisfies ExportedHandler<Env>
