import { generateWeekTimes } from '../week-times'

describe('generateWeekTimes', () => {
  it('returns one slot per week, same weekday and clock time', () => {
    expect(generateWeekTimes('2026-09-11T19:15', 3)).toEqual([
      '2026-09-11T19:15',
      '2026-09-18T19:15',
      '2026-09-25T19:15',
    ])
  })

  it('keeps the clock time across a daylight-saving change', () => {
    // North American DST ends Nov 1 2026. Adding 168 hours would land these
    // on 18:15; local-calendar arithmetic keeps 19:15.
    const weeks = generateWeekTimes('2026-10-30T19:15', 3)

    expect(weeks).toEqual([
      '2026-10-30T19:15',
      '2026-11-06T19:15',
      '2026-11-13T19:15',
    ])
  })

  it('crosses a month and a year boundary', () => {
    expect(generateWeekTimes('2026-12-25T18:00', 3)).toEqual([
      '2026-12-25T18:00',
      '2027-01-01T18:00',
      '2027-01-08T18:00',
    ])
  })

  it.each([0, -1])('returns nothing for a week count of %p', (weekCount) => {
    expect(generateWeekTimes('2026-09-11T19:15', weekCount)).toEqual([])
  })

  it.each(['', 'not a date'])('returns nothing for %p', (firstMatch) => {
    expect(generateWeekTimes(firstMatch, 5)).toEqual([])
  })
})