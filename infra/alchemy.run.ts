import * as Cloudflare from '@alchemy.run/cloudflare'
import * as Alchemy from 'alchemy'
import * as Effect from 'effect/Effect'

export const Website = Cloudflare.Website.Foldkit('YeetIt', {
  name: 'yeet-it',
  rootDir: '..',
  observability: { enabled: true },
  main: 'src/worker/index.ts',
  assets: {
    runWorkerFirst: ['/api/*'],
  },
})

export default Alchemy.Stack(
  'YeetIt',
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const website = yield* Website

    return { url: website.url }
  }),
)
