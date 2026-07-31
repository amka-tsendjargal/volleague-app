import { validateLoginInput, type LoginInput } from '../validation'

// A fully-valid baseline; each test overrides just the field under scrutiny.
function validInput(overrides: Partial<LoginInput> = {}): LoginInput {
  return {
    email: 'bing@example.com',
    password: 'supersecret',
    ...overrides,
  }
}

describe('validateLoginInput', () => {
  it('returns no errors for fully valid input', () => {
    expect(validateLoginInput(validInput())).toEqual({})
  })

  describe('email', () => {
    it('flags a missing email', () => {
      expect(validateLoginInput(validInput({ email: '' })).email).toBe(
        'Email is required.'
      )
    })

    it.each(['plainaddress', 'missing@tld', 'no@dot', '@no-local.com', 'a b@c.com'])(
      'flags malformed email %p',
      (email) => {
        expect(validateLoginInput(validInput({ email })).email).toBe(
          'Enter a valid email address.'
        )
      }
    )

    it('accepts a well-formed email', () => {
      expect(
        validateLoginInput(validInput({ email: 'a.b+tag@sub.example.co' })).email
      ).toBeUndefined()
    })
  })

  describe('password', () => {
    it('flags a missing password', () => {
      expect(validateLoginInput(validInput({ password: '' })).password).toBe(
        'Password is required.'
      )
    })

    // Signup enforces a minimum length; login must not. Accounts created under
    // an older policy still need to get in, and rejecting a short password here
    // would reveal that the stored one can't be that short.
    it('accepts a password shorter than the signup minimum', () => {
      expect(
        validateLoginInput(validInput({ password: 'a' })).password
      ).toBeUndefined()
    })

    it('accepts a password that is only whitespace', () => {
      expect(
        validateLoginInput(validInput({ password: '   ' })).password
      ).toBeUndefined()
    })
  })

  it('reports every invalid field at once', () => {
    expect(validateLoginInput({ email: 'bad', password: '' })).toEqual({
      email: 'Enter a valid email address.',
      password: 'Password is required.',
    })
  })
})
