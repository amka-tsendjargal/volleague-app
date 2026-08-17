import { getInitials } from '../profile'

describe('getInitials', () => {
  it('takes the first letter of each name', () => {
    expect(getInitials('Aiden', 'Wong')).toBe('AW')
  })

  it('uppercases lowercase names', () => {
    expect(getInitials('aiden', 'wong')).toBe('AW')
  })

  it('ignores surrounding whitespace', () => {
    expect(getInitials('  Aiden  ', '  Wong  ')).toBe('AW')
  })

  it('falls back to one letter when only a first name is set', () => {
    expect(getInitials('Aiden', '')).toBe('A')
  })

  it('falls back to one letter when only a last name is set', () => {
    expect(getInitials('', 'Wong')).toBe('W')
  })

  it('treats a whitespace-only name as absent', () => {
    expect(getInitials('   ', '   ', 'aiden@example.com')).toBe('A')
  })

  // Mirrors how the displayed name degrades: the profile row may be missing
  // or unreadable, and the email is what the rest of the UI falls back to.
  it('uses the fallback when both names are empty', () => {
    expect(getInitials('', '', 'aiden@example.com')).toBe('A')
  })

  it('prefers real names over the fallback', () => {
    expect(getInitials('Aiden', 'Wong', 'other@example.com')).toBe('AW')
  })

  // The bubble should never render blank, even with nothing to work with.
  it('returns a placeholder when there is nothing at all', () => {
    expect(getInitials('', '')).toBe('?')
  })

  it('returns a placeholder when the fallback is also empty', () => {
    expect(getInitials('', '', '')).toBe('?')
  })

  // charAt(0) would slice an astral character in half and render a
  // replacement box; Array.from splits by code point instead.
  it('keeps a multi-byte first character intact', () => {
    expect(getInitials('😀mber', 'Wong')).toBe('😀W')
  })

  it('handles accented characters', () => {
    expect(getInitials('Élodie', 'Ngô')).toBe('ÉN')
  })
})
