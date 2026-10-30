/**
 * Measure the initial browser payload: the JS and CSS referenced by dist/index.html.
 *
 *   pnpm build && node scripts/measure-bundle.ts [--url https://yeet-it.example.workers.dev] [--budget 100]
 *
 * Local sizes use gzip -9 and brotli q11. With --url, also downloads each asset
 * from the live site with `Accept-Encoding: br` and `gzip` and reports the bytes
 * actually transferred.
 */
import { get } from 'node:https'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

import { NodeRuntime, NodeServices } from '@effect/platform-node'
import { Array, Console, Data, Effect, Option, pipe } from 'effect'
import { FileSystem } from 'effect/FileSystem'

class BudgetExceeded extends Data.TaggedError('BudgetExceeded')<{
  readonly gzipKilobytes: number
  readonly budgetKilobytes: number
}> {}

class LiveFetchFailed extends Data.TaggedError('LiveFetchFailed')<{
  readonly url: string
}> {}

const argv = process.argv.slice(2)

const option = (name: string): Option.Option<string> =>
  pipe(
    Array.findFirstIndex(argv, argument => argument === `--${name}`),
    Option.flatMap(index => Array.get(argv, index + 1)),
  )

const kilobytes = (bytes: number): string => `${(bytes / 1000).toFixed(1)} KB`

const assetPaths = (html: string): ReadonlyArray<string> =>
  Array.map(
    [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)],
    match => match[1] ?? '',
  )

/** Bytes on the wire: node:https does not decompress, unlike fetch. */
const transferred = (url: string, encoding: string) =>
  Effect.tryPromise({
    try: () =>
      new Promise<number>((resolve, reject) => {
        get(url, { headers: { 'accept-encoding': encoding } }, response => {
          let bytes = 0

          response.on('data', (chunk: Buffer) => {
            bytes += chunk.byteLength
          })
          response.on('end', () => resolve(bytes))
          response.on('error', reject)
        }).on('error', reject)
      }),
    catch: () => new LiveFetchFailed({ url }),
  })

const program = Effect.gen(function* () {
  const fs = yield* FileSystem
  const html = yield* fs.readFileString('dist/index.html')
  const paths = assetPaths(html)

  const sizes = yield* Effect.forEach(paths, path =>
    Effect.map(fs.readFile(`dist${path}`), contents => ({
      path,
      raw: contents.byteLength,
      gzip: gzipSync(contents, { level: 9 }).byteLength,
      brotli: brotliCompressSync(contents, {
        params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
      }).byteLength,
    })),
  )

  yield* Effect.forEach(sizes, size =>
    Console.log(
      `${size.path}: raw ${kilobytes(size.raw)}, gzip ${kilobytes(size.gzip)}, brotli ${kilobytes(size.brotli)}`,
    ),
  )

  const total = sizes.reduce(
    (sum, size) => ({
      raw: sum.raw + size.raw,
      gzip: sum.gzip + size.gzip,
      brotli: sum.brotli + size.brotli,
    }),
    { raw: 0, gzip: 0, brotli: 0 },
  )

  yield* Console.log(
    `initial JS + CSS: raw ${kilobytes(total.raw)}, gzip ${kilobytes(total.gzip)}, brotli ${kilobytes(total.brotli)}`,
  )

  yield* Option.match(option('url'), {
    onNone: () => Effect.void,
    onSome: base =>
      Effect.forEach(['br', 'gzip'], encoding =>
        Effect.gen(function* () {
          const bytes = yield* Effect.forEach(paths, path =>
            transferred(`${base}${path}`, encoding),
          )

          yield* Console.log(
            `live (${encoding}): ${kilobytes(bytes.reduce((sum, size) => sum + size, 0))} transferred for initial JS + CSS`,
          )
        }),
      ),
  })

  const budget = Number(Option.getOrElse(option('budget'), () => 'NaN'))

  if (Number.isFinite(budget) && total.gzip / 1000 > budget) {
    return yield* new BudgetExceeded({
      gzipKilobytes: total.gzip / 1000,
      budgetKilobytes: budget,
    })
  }
})

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)))
