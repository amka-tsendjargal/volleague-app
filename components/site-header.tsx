import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ThemePicker } from "@/components/theme-picker";
import { UserMenu } from "@/components/user-menu";
import { AVATAR_BUCKET } from "@/lib/constants";
import { getInitials } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

/**
 * Top bar with the app's navigation, plus the signed-in user's account menu.
 *
 * Rendered from the root layout, so it runs on every request. Home renders for
 * everyone; the avatar menu — which is where viewing the profile and logging
 * out live — only appears once there's a session.
 */
export async function SiteHeader() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let avatarUrl: string | null = null;
  let initials = "";

  if (user) {
    // public.users is the source of truth for the profile: the handle_new_user
    // trigger copies the signup metadata into it, and later profile edits land
    // there rather than in the auth metadata.
    const { data: profile } = await supabase
      .from("users")
      .select("first_name, last_name, avatar_path")
      .eq("id", user.id)
      .single();

    // Falls back to the email if the profile row is missing or unreadable, so
    // the bubble still signals that someone is signed in.
    initials = getInitials(
      profile?.first_name ?? "",
      profile?.last_name ?? "",
      user.email ?? ""
    );

    // The bucket is public, so this is a plain synchronous string build with
    // no request behind it.
    avatarUrl = profile?.avatar_path
      ? supabase.storage.from(AVATAR_BUCKET).getPublicUrl(profile.avatar_path)
          .data.publicUrl
      : null;
  }

  return (
    <header className="sticky top-0 z-40 flex w-full items-center justify-between gap-2 bg-zinc-50 px-4 py-3 dark:bg-black">
      <Button
        nativeButton={false}
        variant="ghost"
        size="sm"
        render={<Link href="/">Home</Link>}
      />

      <div className="flex items-center gap-2">
        <ThemePicker />

        {user && <UserMenu avatarUrl={avatarUrl} initials={initials} />}
      </div>
    </header>
  );
}
