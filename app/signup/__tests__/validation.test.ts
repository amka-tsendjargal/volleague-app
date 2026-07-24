import {
  minPasswordLength,
  validateSignupInput,
  type SignupInput,
} from '../validation'

// A fully-valid baseline; each test overrides just the field under scrutiny.
function validInput(overrides: Partial<SignupInput> = {}): SignupInput {
  return {
    firstName: 'Bing',
    lastName: 'Chilling',
    email: 'bing@example.com',
    phoneNumber: '+1-587-111-0100',
    password: 'supersecret',
    ...overrides,
  }
}

describe('validateSignupInput', () => {
  it('returns no errors for fully valid input', () => {
    expect(validateSignupInput(validInput())).toEqual({})
  })

  it('flags a missing first name', () => {
    expect(validateSignupInput(validInput({ firstName: '' }))).toEqual({
      firstName: 'First name is required.',
    })
  })

  it('flags a missing last name', () => {
    expect(validateSignupInput(validInput({ lastName: '' }))).toEqual({
      lastName: 'Last name is required.',
    })
  })

  it('flags a missing phone number', () => {
    expect(validateSignupInput(validInput({ phoneNumber: '' }))).toEqual({
      phoneNumber: 'Phone number is required.',
    })
  })

  describe('email', () => {
    it('flags a missing email', () => {
      expect(validateSignupInput(validInput({ email: '' })).email).toBe(
        'Email is required.'
      )
    })

    it.each(['plainaddress', 'missing@tld', 'no@dot', '@no-local.com', 'a b@c.com'])(
      'flags malformed email %p',
      (email) => {
        expect(validateSignupInput(validInput({ email })).email).toBe(
          'Enter a valid email address.'
        )
      }
    )

    it('accepts a well-formed email', () => {
      expect(
        validateSignupInput(validInput({ email: 'a.b+tag@sub.example.co' })).email
      ).toBeUndefined()
    })
  })

  describe('password', () => {
    it('flags a missing password', () => {
      expect(validateSignupInput(validInput({ password: '' })).password).toBe(
        'Password is required.'
      )
    })

    it('flags a password shorter than the minimum', () => {
      const short = 'a'.repeat(minPasswordLength - 1)
      expect(validateSignupInput(validInput({ password: short })).password).toBe(
        `Password must be at least ${minPasswordLength} characters.`
      )
    })

    it('accepts a password exactly at the minimum length', () => {
      const exact = 'a'.repeat(minPasswordLength)
      expect(
        validateSignupInput(validInput({ password: exact })).password
      ).toBeUndefined()
    })
  })

  it('reports every invalid field at once', () => {
    expect(validateSignupInput({
      firstName: '',
      lastName: '',
      email: 'bad',
      phoneNumber: '',
      password: '123',
    })).toEqual({
      firstName: 'First name is required.',
      lastName: 'Last name is required.',
      email: 'Enter a valid email address.',
      phoneNumber: 'Phone number is required.',
      password: `Password must be at least ${minPasswordLength} characters.`,
    })
  })
})
