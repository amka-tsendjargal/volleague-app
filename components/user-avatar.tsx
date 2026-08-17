import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * A user's picture as a circular bubble, falling back to their initials.
 *
 * Presentational only — the caller resolves the URL and the initials, and sets
 * the size through `className` (both the box and the text, e.g.
 * "size-8 text-xs"), since the header renders this much smaller than the
 * profile page does.
 *
 * The whole bubble is hidden from assistive tech. Every current caller either
 * sits next to the user's name or is wrapped in a labelled link, so announcing
 * it would only repeat what a screen reader just said.
 */
export function UserAvatar({
  url,
  initials,
  className,
}: {
  url: string | null;
  initials: string;
  className?: string;
}) {
  return (
    <Avatar aria-hidden className={cn("font-medium", className)}>
      {/* Rendered only when there is a URL, so the fallback shows immediately
          rather than after a failed load. Base UI also swaps back to the
          fallback if the image errors, which covers an expired or deleted
          Storage object. */}
      {url && <AvatarImage src={url} alt="" />}
      {/* The caller sizes the text on the root, but the fallback ships its own
          text-sm, so it has to opt back in to inheriting. */}
      <AvatarFallback className="text-[length:inherit]">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
