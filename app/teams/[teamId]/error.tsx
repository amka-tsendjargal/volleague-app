"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";

export default function TeamDetailsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // The Supabase error is attached as `cause` on the server; only the digest
    // survives to the client, so log what we have and match it up in the
    // server logs.
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="flex w-full max-w-2xl flex-col items-start gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Could not load this team
        </h1>
        <p className="text-sm text-muted-foreground">
          Something went wrong on our end. Please try again.
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-lg bg-foreground px-4 py-2 text-sm text-background"
          >
            Try again
          </button>
          <Link
            href="/teams"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← All teams
          </Link>
        </div>
      </div>
    </div>
  );
}
