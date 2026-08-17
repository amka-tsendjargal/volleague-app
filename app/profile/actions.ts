"use server";

import { revalidatePath } from "next/cache";

import { AVATAR_BUCKET, AVATAR_EXTENSIONS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

import { validateAvatar } from "./validation";

export type UploadAvatarState = {
  error?: string;
  success?: boolean;
};

/**
 * Replaces the signed-in user's profile picture.
 *
 * Each upload writes a NEW object named with the current timestamp rather than
 * overwriting a fixed path. The bucket is public and therefore CDN-cached, so
 * reusing a path would leave viewers looking at the previous picture until the
 * cache expired; a fresh path changes the URL and sidesteps caching entirely.
 * The superseded object is deleted afterwards so a user's folder holds one file.
 *
 * Shaped for `useActionState`: takes the previous state, returns the next one.
 */
export async function uploadAvatar(
  _prevState: UploadAvatarState,
  formData: FormData
): Promise<UploadAvatarState> {
  const file = formData.get("avatar");

  // A missing field or a stray text value arrives as something other than a
  // File; either way there's nothing to upload.
  if (!(file instanceof File)) {
    return { error: "Choose an image to upload." };
  }

  const validationError = validateAvatar(file.size, file.type);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();

  // The page already redirects signed-out visitors, so this only catches a
  // session that expired between loading the form and submitting it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to upload a profile picture." };
  }

  // Read the current path before overwriting it, so the old object can be
  // cleaned up once the new one is safely in place.
  const { data: profile } = await supabase
    .from("users")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  const previousPath: string | null = profile?.avatar_path ?? null;

  // The extension comes from the validated MIME type, never from
  // file.name — the client controls that string, and it ends up in a path.
  // The user's id is the folder, which is what the bucket's RLS policies
  // check against auth.uid().
  const path = `${user.id}/${Date.now()}.${AVATAR_EXTENSIONS[file.type]}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    return { error: "Could not upload the picture. Please try again." };
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ avatar_path: path })
    .eq("id", user.id);

  if (updateError) {
    // The row still points at the old object, so the one just uploaded is
    // unreferenced — drop it rather than leaving it orphaned in the bucket.
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    return { error: "Could not save the picture. Please try again." };
  }

  // Best-effort: the profile already points at the new object, so a failure
  // here leaves an unreferenced file behind but nothing user-visible is wrong.
  if (previousPath) {
    await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]);
  }

  // The profile page holds the server's cached copy of avatar_path, so it
  // would keep rendering the previous picture without this.
  revalidatePath("/profile");

  return { success: true };
}
