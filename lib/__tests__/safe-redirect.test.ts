import { safeRedirectPath } from '../safe-redirect'

describe('safeRedirectPath', () => {
  it('keeps a relative path, query string and all', () => {
    expect(safeRedirectPath('/teams/new?seasonId=3&tierId=1')).toBe(
      '/teams/new?seasonId=3&tierId=1'
    )
  })

  // Each of these would send a freshly signed-in user off site.
  it.each([
    'https://evil.com',
    'http://evil.com',
    '//evil.com',
    '/\\evil.com',
    'javascript:alert(1)',
    'teams/new',
    '',
  ])('refuses %p', (next) => {
    expect(safeRedirectPath(next)).toBe('/')
  })
})
