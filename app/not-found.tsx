import Link from "next/link";

// Without this, Next renders its built-in 404, which injects a
// `prefers-color-scheme` <style> that fights the app's own theming. A real
// page here keeps the 404 on the same theme tokens as everything else.
export default function NotFound() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="flex w-full max-w-2xl flex-col items-start gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground">
          We could not find what you were looking for.
        </p>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Home
        </Link>
      </div>
    </div>
  );
}
