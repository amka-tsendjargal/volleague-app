import { redirect } from "next/navigation";

import { AVATAR_BUCKET } from "@/lib/constants";
import { getInitials } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

import { AvatarForm } from "./avatar-form";

/**
 * The signed-in user's own profile.
 *
 * Shows their name and lets them set a profile picture; it's the landing spot
 * for the rest of the profile fields (phone number, positions, teams) as they
 * get added.
 */
export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // There is no profile to show without a session, and this route is only
  // linked from the header once someone is signed in.
  if (!user) {
    redirect("/login");
  }

  // public.users is the source of truth for the profile: the handle_new_user
  // trigger copies the signup metadata into it, and later profile edits land
  // there rather than in the auth metadata.
  const { data: profile, error } = await supabase
    .from("users")
    .select("first_name, last_name, avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  // A failed query also returns no data, so check the error first — otherwise
  // Supabase being unreachable would render as an empty profile.
  if (error) {
    throw new Error("Failed to load your profile", { cause: error });
  }

  const fullName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : "";
  // Falls back to the email if the profile row is missing or unreadable, so
  // the page still identifies who is signed in.
  const displayName = fullName || user.email;

  const initials = getInitials(
    profile?.first_name ?? "",
    profile?.last_name ?? "",
    user.email ?? ""
  );

  // The bucket is public, so this is a plain synchronous string build with no
  // request behind it — and it stays valid for as long as the object exists.
  const avatarUrl = profile?.avatar_path
    ? supabase.storage.from(AVATAR_BUCKET).getPublicUrl(profile.avatar_path)
        .data.publicUrl
    : null;

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Profile
        </h1>

        <AvatarForm currentUrl={avatarUrl} initials={initials} />

        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Name</span>
          <p className="text-base text-black dark:text-zinc-50">
            {displayName}
          </p>
        </div>
      </div>
    </div>
  );
}
