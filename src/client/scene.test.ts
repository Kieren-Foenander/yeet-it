// @vitest-environment happy-dom
import { Option } from 'effect'
import {
  Command,
  click,
  expect,
  given,
  label,
  role,
  scene,
  submit,
  text,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import { ballrooms } from '../game/fixtures.ts'
import { finishRun, type Run, startRun } from '../game/run.ts'
import { emptyStats } from '../game/stats.ts'
import { SaveProgress, update } from './main.ts'
import { Message } from './message.ts'
import { Feedback, Game, type Model } from './model.ts'
import { view } from './view.ts'

const ready = (run: Run): Model => ({
  today: ballrooms.date,
  origin: 'https://yeet.test',
  storage: 'Available',
  stats: emptyStats,
  game: Game.Ready({
    play: {
      puzzle: ballrooms,
      run,
      draft: '',
      rack: run.start,
      feedback: Feedback.Idle(),
      finishPrompt: 'Idle',
      copy: 'Idle',
    },
  }),
  nextDay: Option.none(),
})

describe('daily game view', () => {
  test('taps letter tiles into a word, previews the yeet, and banks it', () => {
    scene(
      { update, view },
      given(ready(startRun(ballrooms))),
      expect(role('heading', { name: 'yeet it ↗' })).toExist(),
      click(role('button', { name: 'Add B' })),
      click(role('button', { name: 'Add R' })),
      click(role('button', { name: 'Add O' })),
      click(role('button', { name: 'Add O' })),
      click(role('button', { name: 'Add M' })),
      click(role('button', { name: 'Add S' })),
      expect(label('Your next word')).toHaveValue('BROOMS'),
      expect(role('status')).toContainText('Yeeting A · L · L'),
      expect(role('button', { name: 'Yeet 3 letters ↗' })).toExist(),
      submit(role('form', { name: 'Submit a word' })),
      Command.resolve(SaveProgress, Message.SucceededSaveProgress()),
      expect(text('BROOMS banked. Yeeted A · L · L.')).toExist(),
    )
  })

  test('shows the descending share grid once the run is over', () => {
    scene(
      { update, view },
      given(ready(finishRun(startRun(ballrooms)))),
      expect(role('heading', { name: 'A fresh start tomorrow.' })).toExist(),
      expect(role('button', { name: 'Copy result' })).toExist(),
      expect(text(/yeet it #007/)).toExist(),
    )
  })
})
