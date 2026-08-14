import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Keeps non-admins out of the admin UI. Every action under here re-checks
// on its own — Server Actions are reachable by direct POST, so this is for
// the UI, not the guarantee.
//
// notFound rather than redirect so the admin area doesn't announce itself
// to people who can't use it.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");

  if (!isAdmin) {
    notFound();
  }

  return children;
}