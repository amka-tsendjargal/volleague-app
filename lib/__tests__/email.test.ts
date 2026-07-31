import { getEmailError } from '../email'

describe('getEmailError', () => {
  it('flags a missing email', () => {
    expect(getEmailError('')).toBe('Email is required.')
  })

  it.each(['plainaddress', 'missing@tld', 'no@dot', '@no-local.com', 'a b@c.com'])(
    'flags malformed email %p',
    (email) => {
      expect(getEmailError(email)).toBe('Enter a valid email address.')
    }
  )

  // The browser's own `type="email"` check accepts a dotless host; ours doesn't,
  // which is the reason this runs on the client at all rather than leaning on
  // native validation.
  it('flags an address with no dot in the host', () => {
    expect(getEmailError('bing@example')).toBe('Enter a valid email address.')
  })

  it.each([
    'bing@example.com',
    'a.b+tag@sub.example.co',
    "o'brien@example.ie",
  ])('accepts well-formed email %p', (email) => {
    expect(getEmailError(email)).toBeUndefined()
  })

  // Callers trim before calling, so an untrimmed value reaching here is a bug
  // worth surfacing rather than silently accepting.
  it('rejects an address with surrounding whitespace', () => {
    expect(getEmailError('  bing@example.com  ')).toBe(
      'Enter a valid email address.'
    )
  })
})
