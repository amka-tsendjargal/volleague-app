import Link from "next/link";

import { logout } from "@/app/logout/actions";
import { Button } from "@/components/ui/button";
import { ThemePicker } from "@/components/theme-picker";
import { createClient } from "@/lib/supabase/server";

/**
 * Top bar with the app's navigation, plus who is signed in.
 *
 * Rendered from the root layout, so it runs on every request. The nav renders
 * for everyone; the name and log-out control only appear once there's a
 * session.
 */
export async function SiteHeader() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName: string | undefined;

  if (user) {
    // public.users is the source of truth for the profile: the handle_new_user
    // trigger copies the signup metadata into it, and later profile edits land
    // there rather than in the auth metadata.
    const { data: profile } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();

    const fullName = profile
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : "";
    // Falls back to the email if the profile row is missing or unreadable, so
    // the header still signals that someone is signed in.
    displayName = fullName || user.email;
  }

  return (
    <header className="flex w-full items-center justify-between gap-2 bg-zinc-50 px-4 py-3 dark:bg-black">
      <Button
        nativeButton={false}
        variant="ghost"
        size="sm"
        render={<Link href="/">Home</Link>}
      />

      <div className="flex items-center gap-2">
        <ThemePicker />

        {user && (
          <>
            <span className="text-sm text-muted-foreground">Signed in as</span>
            <span className="text-sm font-medium text-black dark:text-zinc-50">
              {displayName}
            </span>
            {/* A plain form rather than a link: signing out is a mutation, so
                it must not be reachable by a GET (a prefetch or a crawler
                would fire it). */}
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                Log out
              </Button>
            </form>
          </>
        )}
      </div>
    </header>
  );
}
