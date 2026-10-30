import { PUZZLE_FORMAT, type Puzzle } from './puzzle.ts'

/** A hand-sized test puzzle (not a real daily puzzle): duplicate L and O, skipped lengths, and a dead end at ROLLS. */
export const ballrooms: Puzzle = {
  format: PUZZLE_FORMAT,
  number: 7,
  date: '2026-11-05',
  start: 'BALLROOMS',
  words: [
    'BALLROOM',
    'ABSORB',
    'BROOMS',
    'BLOOMS',
    'ROLLS',
    'BLOOM',
    'BROOM',
    'SMALL',
    'BALLS',
    'LOOMS',
    'BOOM',
    'BALL',
    'ROOM',
    'MOB',
    'ALL',
    'BOO',
    'ORB',
  ],
  route: ['BALLROOM', 'BROOM', 'BOOM', 'MOB'],
  dictionary: 'test',
}
