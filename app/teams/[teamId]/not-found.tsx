import Link from "next/link";

export default function TeamNotFound() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="flex w-full max-w-2xl flex-col items-start gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Team not found
        </h1>
        <p className="text-sm text-muted-foreground">
          We could not find this team.
        </p>
        <Link
          href="/teams"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← All teams
        </Link>
      </div>
    </div>
  );
}
