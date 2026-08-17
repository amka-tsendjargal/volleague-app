import { AVATAR_MAX_EDGE } from '@/lib/constants'

import { getTargetDimensions } from '../resize'

// Only the sizing math is covered here. resizeAvatar itself drives
// createImageBitmap and canvas, which don't exist in the Node test
// environment — its job is to apply these numbers to a bitmap.
describe('getTargetDimensions', () => {
  it('leaves an image already within the bound untouched', () => {
    expect(getTargetDimensions(200, 150, 512)).toEqual({
      width: 200,
      height: 150,
    })
  })

  // Upscaling would cost bytes without adding any detail.
  it('does not upscale an image smaller than the bound', () => {
    expect(getTargetDimensions(64, 64, 512)).toEqual({ width: 64, height: 64 })
  })

  it('leaves an image exactly at the bound untouched', () => {
    expect(getTargetDimensions(512, 512, 512)).toEqual({
      width: 512,
      height: 512,
    })
  })

  it('scales a landscape photo by its width', () => {
    expect(getTargetDimensions(4032, 3024, 512)).toEqual({
      width: 512,
      height: 384,
    })
  })

  it('scales a portrait photo by its height', () => {
    expect(getTargetDimensions(3024, 4032, 512)).toEqual({
      width: 384,
      height: 512,
    })
  })

  it('preserves the aspect ratio when scaling down', () => {
    const { width, height } = getTargetDimensions(1000, 500, 512)
    expect(width / height).toBeCloseTo(2)
  })

  // A zero-dimension canvas throws, and rounding a very lopsided image can
  // otherwise land on 0.
  it('never returns a zero dimension for an extreme aspect ratio', () => {
    const { width, height } = getTargetDimensions(4000, 1, 512)
    expect(width).toBe(512)
    expect(height).toBeGreaterThanOrEqual(1)
  })

  it('defaults to the shared max edge', () => {
    expect(getTargetDimensions(4032, 3024)).toEqual(
      getTargetDimensions(4032, 3024, AVATAR_MAX_EDGE)
    )
  })
})
