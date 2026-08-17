import { AVATAR_MAX_BYTES, AVATAR_MAX_SOURCE_BYTES } from '@/lib/constants'

import { validateAvatar, validateSourceImage } from '../validation'

// A fully-valid baseline; each test overrides just the field under scrutiny.
function validateResized(
  overrides: Partial<{ size: number; type: string }> = {}
) {
  const input = { size: 40 * 1024, type: 'image/webp', ...overrides }
  return validateAvatar(input.size, input.type)
}

function validateSource(
  overrides: Partial<{ size: number; type: string }> = {}
) {
  const input = { size: 3 * 1024 * 1024, type: 'image/jpeg', ...overrides }
  return validateSourceImage(input.size, input.type)
}

describe('validateSourceImage', () => {
  // The whole point of the client-side resize: picking a big camera photo is
  // normal and must not be rejected the way it would be at the bucket's limit.
  it('accepts a multi-megabyte camera photo', () => {
    expect(validateSource({ size: 5 * 1024 * 1024 })).toBeNull()
  })

  it('accepts a source far larger than the resized ceiling', () => {
    expect(validateSource({ size: AVATAR_MAX_BYTES * 10 })).toBeNull()
  })

  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s', (type) => {
    expect(validateSource({ type })).toBeNull()
  })

  it('rejects an empty file, which is what a missing selection looks like', () => {
    expect(validateSource({ size: 0 })).toBe('Choose an image to upload.')
  })

  it('rejects a disallowed image type before any decoding happens', () => {
    expect(validateSource({ type: 'image/gif' })).toBe(
      'Profile picture must be a JPG, PNG, or WebP image.'
    )
  })

  // SVG can carry scripts and would be served from our own origin on a public
  // URL, so it stays out even though it is an image.
  it('rejects SVG', () => {
    expect(validateSource({ type: 'image/svg+xml' })).toBe(
      'Profile picture must be a JPG, PNG, or WebP image.'
    )
  })

  it('accepts a source exactly at the decode ceiling', () => {
    expect(validateSource({ size: AVATAR_MAX_SOURCE_BYTES })).toBeNull()
  })

  it('rejects a source one byte over the decode ceiling', () => {
    expect(validateSource({ size: AVATAR_MAX_SOURCE_BYTES + 1 })).toBe(
      'That image is too large to process. Choose one under 20MB.'
    )
  })
})

describe('validateAvatar', () => {
  it('accepts a typical resized avatar', () => {
    expect(validateResized()).toBeNull()
  })

  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s', (type) => {
    expect(validateResized({ type })).toBeNull()
  })

  it('rejects an empty file', () => {
    expect(validateResized({ size: 0 })).toBe('Choose an image to upload.')
  })

  it('rejects a disallowed image type', () => {
    expect(validateResized({ type: 'image/gif' })).toBe(
      'Profile picture must be a JPG, PNG, or WebP image.'
    )
  })

  it('accepts a file exactly at the size limit', () => {
    expect(validateResized({ size: AVATAR_MAX_BYTES })).toBeNull()
  })

  it('rejects a file one byte over the limit', () => {
    expect(validateResized({ size: AVATAR_MAX_BYTES + 1 })).toBe(
      'Profile picture must be 512KB or smaller.'
    )
  })

  // The server runs this against whatever actually arrived, so a client that
  // skipped the resize is still caught here.
  it('rejects an unresized camera photo', () => {
    expect(validateResized({ size: 3 * 1024 * 1024, type: 'image/jpeg' })).toBe(
      'Profile picture must be 512KB or smaller.'
    )
  })

  // Type is checked before size, so an oversized file with a bad type reports
  // the type problem — fixing the size alone would not have helped.
  it('reports the type error when both are wrong', () => {
    expect(
      validateResized({ size: AVATAR_MAX_BYTES + 1, type: 'image/gif' })
    ).toBe('Profile picture must be a JPG, PNG, or WebP image.')
  })
})
