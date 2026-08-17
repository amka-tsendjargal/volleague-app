"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Copies a short value to the clipboard, confirming with a tick for a couple
 * of seconds. Only the button is a Client Component — whatever it copies
 * stays rendered on the server.
 */
export function CopyButton({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // The clipboard is unavailable on an insecure origin and can be
      // refused outright. Staying quiet beats confirming a copy that never
      // happened — the value is on screen to select by hand either way.
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleCopy}
        aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
      {/* The icon swap is invisible to a screen reader, and the button's own
          name only gets re-announced on refocus. */}
      <span aria-live="polite" className="sr-only">
        {copied ? `${label} copied` : ""}
      </span>
    </>
  );
}
