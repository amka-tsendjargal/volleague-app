"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { UserAvatar } from "@/components/user-avatar";
import { AVATAR_ALLOWED_TYPES } from "@/lib/constants";
import { validateAvatar, validateSourceImage } from "./validation";
import { resizeAvatar } from "./resize";
import { uploadAvatar, type UploadAvatarState } from "./actions";

const initialState: UploadAvatarState = {};

export function AvatarForm({
  currentUrl,
  initials,
}: {
  currentUrl: string | null;
  initials: string;
}) {
  const [state, formAction, pending] = useActionState(
    uploadAvatar,
    initialState
  );

  // The downscaled WebP produced from the user's pick. This — not the file
  // sitting in the input — is what gets uploaded.
  const [resizedFile, setResizedFile] = useState<File | null>(null);
  // Object URL for that resized file, so the preview is literally the image
  // that will be stored rather than an approximation of it.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Decoding and re-encoding a large photo takes a moment; the button stays
  // disabled and labelled until there's something to send.
  const [resizing, setResizing] = useState(false);
  // Checked on the client purely to fail fast; uploadAvatar runs the same
  // rules server-side, and the bucket enforces them regardless.
  const [clientError, setClientError] = useState<string | null>(null);

  // Every successful upload writes a new timestamped path, so a changed
  // currentUrl is exactly the signal that the server now holds what the
  // preview was standing in for. Dropping it during render (rather than from
  // an effect) means there's no frame where the stale preview is on screen.
  const [uploadedUrl, setUploadedUrl] = useState(currentUrl);
  if (currentUrl !== uploadedUrl) {
    setUploadedUrl(currentUrl);
    setPreviewUrl(null);
    setResizedFile(null);
  }

  // Object URLs pin their blob in memory until revoked. Revoking on the next
  // pick and on unmount keeps a user swapping through files from leaking them.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!state.success) return;
    toast.add({
      id: "avatar-updated",
      type: "success",
      title: "Profile picture updated",
    });
  }, [state.success]);

  function reject(message: string, input?: HTMLInputElement) {
    // Clearing the input as well as the state means the submit button can't
    // send a file we already know won't work.
    if (input) input.value = "";
    setPreviewUrl(null);
    setResizedFile(null);
    setClientError(message);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];

    if (!file) {
      setPreviewUrl(null);
      setResizedFile(null);
      setClientError(null);
      return;
    }

    const sourceError = validateSourceImage(file.size, file.type);
    if (sourceError) {
      reject(sourceError, input);
      return;
    }

    setClientError(null);
    setResizing(true);

    try {
      const resized = await resizeAvatar(file);

      // Belt and braces: if the browser fell back to PNG, or produced
      // something unexpectedly large, catch it here rather than at the bucket.
      const resizedError = validateAvatar(resized.size, resized.type);
      if (resizedError) {
        reject(resizedError, input);
        return;
      }

      setResizedFile(resized);
      setPreviewUrl(URL.createObjectURL(resized));
    } catch {
      // createImageBitmap rejects on a corrupt file or one whose contents
      // don't match its declared type.
      reject("Could not read that image. Try a different file.", input);
    } finally {
      setResizing(false);
    }
  }

  // The input still holds the original file, so swap in the resized one on the
  // way to the action — that's the file the whole exercise is about.
  function submit(formData: FormData) {
    if (resizedFile) {
      formData.set("avatar", resizedFile);
    }
    formAction(formData);
  }

  const shownUrl = previewUrl ?? currentUrl;
  const error = clientError ?? state.error;

  return (
    <form action={submit} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <UserAvatar
          url={shownUrl}
          initials={initials}
          className="size-20 text-xl"
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="avatar">Profile picture</Label>
          <input
            // Remounting on a new currentUrl clears the browser's held file
            // after a successful upload, so the same picture can't be
            // submitted twice by just hitting the button again.
            key={currentUrl ?? "none"}
            id="avatar"
            name="avatar"
            type="file"
            accept={AVATAR_ALLOWED_TYPES.join(",")}
            onChange={handleFileChange}
            aria-invalid={Boolean(error)}
            className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-background file:px-2.5 file:py-1 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            JPG, PNG, or WebP. Large photos are resized automatically.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <Button type="submit" disabled={pending || resizing || !resizedFile}>
          {resizing ? "Preparing…" : pending ? "Uploading…" : "Upload picture"}
        </Button>
      </div>
    </form>
  );
}
