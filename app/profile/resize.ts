import {
  AVATAR_MAX_EDGE,
  AVATAR_OUTPUT_TYPE,
} from "@/lib/constants";

/**
 * Scales a width/height pair so its longest edge is at most `maxEdge`,
 * preserving the aspect ratio.
 *
 * Images already within the bound are returned untouched — upscaling a small
 * picture would cost bytes and add no detail.
 *
 * Pure and browser-free so the sizing rules can be unit-tested; the canvas
 * work that uses it lives in resizeAvatar below.
 */
export function getTargetDimensions(
  width: number,
  height: number,
  maxEdge: number = AVATAR_MAX_EDGE
): { width: number; height: number } {
  const longestEdge = Math.max(width, height);

  if (longestEdge <= maxEdge) {
    return { width, height };
  }

  const scale = maxEdge / longestEdge;

  // Rounding can land on 0 for an extremely lopsided image (e.g. 4000x1), and
  // a zero-dimension canvas throws — so never go below a single pixel.
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Downscales an image in the browser and re-encodes it as WebP.
 *
 * Runs before upload rather than transforming on read, because the source file
 * is the expensive part: an untouched camera photo is several megabytes, all
 * of which would otherwise cross the wire and sit in the bucket to render an
 * 80-pixel circle. (Supabase's own image transformation would fix only the
 * render, and is Pro-plan gated.)
 *
 * Browser-only — it touches createImageBitmap and canvas, so it can only be
 * called from a client component.
 */
export async function resizeAvatar(file: File): Promise<File> {
  // `from-image` applies the EXIF orientation tag. Without it, photos taken in
  // portrait on a phone decode sideways, since the camera records them
  // landscape plus a rotation flag.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  const { width, height } = getTargetDimensions(bitmap.width, bitmap.height);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not get a 2D canvas context");
    }

    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, AVATAR_OUTPUT_TYPE, 0.85)
    );

    if (!blob) {
      throw new Error("Could not encode the resized image");
    }

    // A browser that can't encode the requested type silently falls back to
    // PNG, so take the extension from what actually came back rather than from
    // what was asked for — the server derives the stored path from this type.
    const extension = blob.type.split("/")[1] ?? "webp";

    return new File([blob], `avatar.${extension}`, { type: blob.type });
  } finally {
    // Frees the decoded pixels immediately instead of waiting for GC. Matters
    // when someone cycles through several large photos before settling on one.
    bitmap.close();
  }
}
