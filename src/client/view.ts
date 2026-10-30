import { Array, Match, Option } from 'effect'
import type { Document, Html, HtmlBuilder } from 'foldkit/html'

import {
  addDays,
  formatPuzzleNumber,
  puzzleNumberOf,
  startOfUtcDay,
} from '../game/day.ts'
import { usedPositions } from '../game/letters.ts'
import { judgeMove, MAXIMUM_SCORE, MoveVerdict } from '../game/rules.ts'
import {
  currentWord,
  isFinished,
  RunStatus,
  score,
  shareText,
} from '../game/run.ts'
import { streakOn } from '../game/stats.ts'
import { SHARE_TEXT_ID } from './main.ts'
import { Message } from './message.ts'
import { Feedback, Game, type Model, type Play } from './model.ts'

type H = HtmlBuilder<Message>

const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? '' : 's'}`

const lettersText = (letters: ReadonlyArray<string>): string =>
  letters.join(' · ')

type Tone = 'quiet' | 'good' | 'bad'

type Hint = Readonly<{ tone: Tone; text: string }>

const hint = (tone: Tone, text: string): Hint => ({ tone, text })

const rejection = (verdict: MoveVerdict, draft: string): Hint =>
  MoveVerdict.match(verdict, {
    Empty: () => hint('quiet', ''),
    UsesMissingLetters: () =>
      hint('bad', 'You don’t have those letters. Yeeted letters stay gone.'),
    TooShort: () => hint('bad', 'Words need at least 3 letters.'),
    NotShorter: () => hint('bad', 'Make it shorter: yeet at least one letter.'),
    NotAWord: () =>
      hint(
        'bad',
        `${draft} isn’t in the word list. Nothing lost. Try another.`,
      ),
    Valid: () => hint('good', ''),
  })

const liveHint = (play: Play): Hint => {
  const verdict = judgeMove(currentWord(play.run), play.draft, () => true)

  return MoveVerdict.match(verdict, {
    Valid: ({ removed }) =>
      play.puzzle.words.includes(play.draft)
        ? hint('good', `Yeeting ${lettersText(removed)}`)
        : hint('quiet', `Would yeet ${lettersText(removed)}`),
    Empty: () => hint('quiet', ''),
    UsesMissingLetters: () => rejection(verdict, play.draft),
    TooShort: () => hint('quiet', 'Keep going: at least 3 letters.'),
    NotShorter: () => rejection(verdict, play.draft),
    NotAWord: () => rejection(verdict, play.draft),
  })
}

const hintFor = (play: Play): Hint =>
  Feedback.match(play.feedback, {
    Rejected: ({ verdict }) => rejection(verdict, play.draft),
    Banked: ({ word, removed }) =>
      play.draft.length > 0
        ? liveHint(play)
        : hint('good', `${word} banked. Yeeted ${lettersText(removed)}.`),
    Idle: () =>
      play.draft.length > 0
        ? liveHint(play)
        : hint(
            'quiet',
            'Tap or type a shorter word. Leave at least one letter behind.',
          ),
  })

const isSubmittable = (play: Play): boolean =>
  MoveVerdict.match(
    judgeMove(currentWord(play.run), play.draft, word =>
      play.puzzle.words.includes(word),
    ),
    {
      Valid: () => true,
      Empty: () => false,
      UsesMissingLetters: () => false,
      TooShort: () => false,
      NotShorter: () => false,
      NotAWord: () => false,
    },
  )

const statView = (label: string, value: string, h: H): Html =>
  h.div([h.Class('stat')], [h.span([], [label]), h.strong([], [value])])

const headerView = (model: Model, h: H): Html =>
  h.header(
    [h.Class('top')],
    [
      h.h1([h.Class('brand')], ['yeet ', h.span([], ['it']), ' ↗']),
      h.p(
        [h.Class('day')],
        [
          formatPuzzleNumber(puzzleNumberOf(model.today)),
          h.br([]),
          new Date(startOfUtcDay(model.today)).toLocaleDateString(undefined, {
            timeZone: 'UTC',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
        ],
      ),
    ],
  )

const rackView = (play: Play, h: H): Html => {
  const used = usedPositions(play.rack, play.draft)
  const drafting = play.draft.length > 0

  return h.div(
    [h.Class('rack'), h.Role('group'), h.AriaLabel('Your letters')],
    play.rack.split('').map((letter, index) => {
      const isUsed = used[index] === true

      return h.button(
        [
          h.Type('button'),
          h.Class(isUsed ? 'tile used' : drafting ? 'tile leaving' : 'tile'),
          h.AriaPressed(isUsed ? 'true' : 'false'),
          h.AriaLabel(isUsed ? `Remove ${letter}` : `Add ${letter}`),
          h.OnClick(Message.ClickedTile({ index })),
        ],
        [letter],
      )
    }),
  )
}

const finishView = (play: Play, h: H): Html =>
  Match.value(play.finishPrompt).pipe(
    Match.when('Idle', () =>
      h.div(
        [h.Class('below')],
        [
          h.p([], ['Only submitted words are permanent.']),
          h.button(
            [
              h.Type('button'),
              h.Class('link'),
              h.OnClick(Message.ClickedFinish()),
            ],
            ['Finish run'],
          ),
        ],
      ),
    ),
    Match.when('Confirming', () =>
      h.div(
        [h.Class('below confirm'), h.Role('alert')],
        [
          h.p(
            [],
            [
              `End today’s run at ${plural(score(play.run), 'word')}? You can’t play again until tomorrow.`,
            ],
          ),
          h.div(
            [h.Class('actions')],
            [
              h.button(
                [
                  h.Type('button'),
                  h.Class('link'),
                  h.OnClick(Message.ClickedCancelFinish()),
                ],
                ['Keep playing'],
              ),
              h.button(
                [
                  h.Type('button'),
                  h.Class('danger'),
                  h.OnClick(Message.ClickedConfirmFinish()),
                ],
                ['Finish'],
              ),
            ],
          ),
        ],
      ),
    ),
    Match.exhaustive,
  )

const playView = (play: Play, h: H): Html => {
  const guidance = hintFor(play)
  const word = currentWord(play.run)
  const removing = word.length - play.draft.length

  return h.section(
    [h.Class('card'), h.AriaLabel('Make your next word')],
    [
      h.div(
        [h.Class('row')],
        [
          h.span([h.Class('eyebrow')], ['Your letters']),
          h.button(
            [
              h.Type('button'),
              h.Class('link'),
              h.OnClick(Message.ClickedShuffle()),
            ],
            ['Shuffle'],
          ),
        ],
      ),
      rackView(play, h),
      h.form(
        [
          h.OnSubmit(Message.SubmittedDraft()),
          h.AriaLabel('Submit a word'),
          h.Novalidate(true),
        ],
        [
          h.label([h.For('word'), h.Class('label')], ['Your next word']),
          h.div(
            [h.Class('entry')],
            [
              h.input([
                h.Id('word'),
                h.Class('word'),
                h.Value(play.draft),
                h.OnInput(value => Message.UpdatedDraft({ value })),
                h.Placeholder('Type or tap letters'),
                h.Autocomplete('off'),
                h.Autocapitalize('characters'),
                h.Autocorrect('off'),
                h.Spellcheck(false),
                h.EnterKeyHint('go'),
                h.Maxlength(word.length),
                h.AriaDescribedBy('feedback'),
              ]),
              h.button(
                [
                  h.Type('button'),
                  h.Class('key'),
                  h.AriaLabel('Delete last letter'),
                  h.OnClick(Message.ClickedBackspace()),
                ],
                ['⌫'],
              ),
              h.button(
                [
                  h.Type('button'),
                  h.Class('key'),
                  h.AriaLabel('Clear word'),
                  h.OnClick(Message.ClickedClear()),
                ],
                ['×'],
              ),
            ],
          ),
          h.p(
            [
              h.Id('feedback'),
              h.Class(`feedback ${guidance.tone}`),
              h.Role('status'),
            ],
            [guidance.text],
          ),
          h.button(
            [h.Type('submit'), h.Class('primary')],
            [
              isSubmittable(play)
                ? `Yeet ${plural(removing, 'letter')} ↗`
                : 'Yeet the leftovers ↗',
            ],
          ),
        ],
      ),
    ],
  )
}

const resultTitle = (points: number): string =>
  Match.value(points).pipe(
    Match.when(MAXIMUM_SCORE, () => 'Nothing wasted. ↗'),
    Match.when(0, () => 'A fresh start tomorrow.'),
    Match.orElse(() => `${plural(points, 'word')}. Letters well spent.`),
  )

const nextPuzzleTime = (model: Model): string =>
  new Date(startOfUtcDay(addDays(model.today, 1))).toLocaleTimeString(
    undefined,
    { hour: 'numeric', minute: '2-digit' },
  )

const resultView = (model: Model, play: Play, h: H): Html => {
  const points = score(play.run)
  const text = shareText(play.run, model.origin)

  return h.section(
    [h.Class('card result'), h.AriaLabelledBy('result-title')],
    [
      h.p([h.Class('eyebrow')], ['Run complete']),
      h.h2([h.Id('result-title')], [resultTitle(points)]),
      h.p(
        [],
        [
          RunStatus.match(play.run.status, {
            Playing: () => '',
            Finished: ({ reason }) =>
              Match.value(reason).pipe(
                Match.when(
                  'ReachedMinimum',
                  () => 'You reached three letters.',
                ),
                Match.when(
                  'NoShorterWord',
                  () => 'No shorter word was left in your letters.',
                ),
                Match.when('Chose', () => 'You banked your chain.'),
                Match.exhaustive,
              ),
          }),
          ` ${points}/${MAXIMUM_SCORE} today.`,
        ],
      ),
      Match.value(play.copy).pipe(
        Match.when('Manual', () =>
          h.textarea([
            h.Id(SHARE_TEXT_ID),
            h.Class('share'),
            h.Readonly(true),
            h.Rows(9),
            h.AriaLabel('Your result, ready to copy'),
            h.Value(text),
          ]),
        ),
        Match.orElse(() =>
          h.pre([h.Class('share'), h.AriaLabel('Your result')], [text]),
        ),
      ),
      h.button(
        [
          h.Type('button'),
          h.Class('primary'),
          h.OnClick(Message.ClickedCopy()),
        ],
        ['Copy result'],
      ),
      h.p(
        [h.Class('note'), h.Role('status')],
        [
          Match.value(play.copy).pipe(
            Match.when('Idle', () => ''),
            Match.when('Copied', () => 'Copied. Drop it in the group chat.'),
            Match.when(
              'Manual',
              () =>
                'Copying is blocked here. The result is selected: copy it manually.',
            ),
            Match.exhaustive,
          ),
        ],
      ),
      h.div(
        [h.Class('stats')],
        [
          statView('Played', `${model.stats.played}`, h),
          statView('Streak', `${streakOn(model.stats, model.today)}`, h),
          statView('Best', `${model.stats.bestStreak}`, h),
          statView('Perfect', `${model.stats.perfect}`, h),
        ],
      ),
      h.details(
        [],
        [
          h.summary([], ['See one 6/6 route']),
          h.p(
            [h.Class('route')],
            [[play.puzzle.start, ...play.puzzle.route].join(' → ')],
          ),
        ],
      ),
      h.p(
        [h.Class('note')],
        [`Next puzzle at ${nextPuzzleTime(model)} (midnight UTC).`],
      ),
    ],
  )
}

const chainView = (play: Play, h: H): Html =>
  h.section(
    [h.Class('chain'), h.AriaLabel('Your chain')],
    [
      h.div(
        [h.Class('row')],
        [
          h.span([h.Class('eyebrow')], ['Your chain']),
          h.span(
            [h.Class('quiet')],
            [
              Array.match(play.run.chain, {
                onEmpty: () => 'Make your first move',
                onNonEmpty: chain => `${plural(chain.length, 'word')} banked`,
              }),
            ],
          ),
        ],
      ),
      h.ol(
        [],
        [
          h.li(
            [h.Class('start')],
            [h.span([], [play.run.start]), h.span([], ['start'])],
          ),
          ...play.run.chain.map(step =>
            h.li(
              [],
              [
                h.span([], [step.word]),
                h.span([], [`− ${step.removed.join(' ')}`]),
              ],
            ),
          ),
        ],
      ),
    ],
  )

const readyView = (model: Model, play: Play, h: H): ReadonlyArray<Html> => [
  h.div(
    [h.Class('stats')],
    [
      statView('Words', `${score(play.run)}/${MAXIMUM_SCORE}`, h),
      statView('Letters', `${currentWord(play.run).length}`, h),
      statView('Streak', `${streakOn(model.stats, model.today)}`, h),
    ],
  ),
  isFinished(play.run) ? resultView(model, play, h) : playView(play, h),
  isFinished(play.run) ? h.empty : finishView(play, h),
  chainView(play, h),
]

export const view = (model: Model, h: H): Document => ({
  title: 'yeet it',
  body: h.main(
    [h.Class('app')],
    [
      headerView(model, h),
      Option.match(model.nextDay, {
        onNone: () => h.empty,
        onSome: () =>
          h.div(
            [h.Class('banner'), h.Role('status')],
            [
              h.span(
                [],
                ['A new puzzle is out. This run still counts for yesterday.'],
              ),
              h.button(
                [
                  h.Type('button'),
                  h.Class('link'),
                  h.OnClick(Message.ClickedPlayToday()),
                ],
                ['Play today’s'],
              ),
            ],
          ),
      }),
      model.storage === 'Unavailable'
        ? h.p(
            [h.Class('banner'), h.Role('status')],
            [
              'This browser isn’t saving progress. Finish today’s run in this tab.',
            ],
          )
        : h.empty,
      ...Game.match(model.game, {
        Loading: () => [
          h.p(
            [h.Class('quiet'), h.Role('status')],
            ['Loading today’s letters…'],
          ),
        ],
        Failed: ({ reason }) => [
          h.div(
            [h.Class('card'), h.Role('alert')],
            [
              h.p([], [reason]),
              h.button(
                [
                  h.Type('button'),
                  h.Class('primary'),
                  h.OnClick(Message.ClickedRetry()),
                ],
                ['Try again'],
              ),
            ],
          ),
        ],
        Ready: ({ play }) => readyView(model, play, h),
      }),
    ],
  ),
})
