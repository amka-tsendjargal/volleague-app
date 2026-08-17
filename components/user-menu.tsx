"use client";

import Link from "next/link";
import { ChevronDownIcon, LogOutIcon, UserIcon } from "lucide-react";

import { logout } from "@/app/logout/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";

/**
 * The header's avatar bubble, opening the signed-in user's account menu.
 *
 * A client component because the menu is interactive, but the caller stays on
 * the server: it resolves the avatar URL and the initials and passes them down,
 * so nothing about the session is fetched in the browser.
 *
 * The bubble itself is hidden from assistive tech, so the trigger carries the
 * accessible name.
 */
export function UserMenu({
  avatarUrl,
  initials,
}: {
  avatarUrl: string | null;
  initials: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="group relative rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <UserAvatar
          url={avatarUrl}
          initials={initials}
          className="size-8 text-xs"
        />
        {/* Sits over the bottom-right of the bubble so the bubble itself stays
            a plain circle, and flips while the menu is open. Decorative: the
            trigger already announces itself as a menu button. */}
        <span
          aria-hidden
          className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-zinc-50 transition-transform group-data-popup-open:rotate-180 dark:ring-black"
        >
          <ChevronDownIcon className="size-2.5" />
        </span>
      </DropdownMenuTrigger>

      {/* The trigger is only as wide as the bubble, so the menu sizes to its
          own content instead of the anchor, and hangs off the right edge to
          stay inside the viewport. */}
      <DropdownMenuContent align="end" className="w-auto min-w-40">
        <DropdownMenuItem render={<Link href="/profile" />}>
          <UserIcon />
          View profile
        </DropdownMenuItem>
        {/* Signing out is a mutation, so it goes through the server action
            rather than a link: calling it from the click handler posts to the
            server, and the action redirects home from there. */}
        <DropdownMenuItem onClick={() => logout()}>
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
