import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const {data: isAdmin } = await supabase.rpc("is_admin");
  
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Volleague
      </h1>
      <div className="flex items-center gap-3">
        <Button
          nativeButton={false}
          render={<Link href="/teams/new">Create a Team</Link>}
        />
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href="/teams">View Teams</Link>}
        />
        {isAdmin && (
          <Button 
            nativeButton={false}
            render={<Link href={"/admin/seasons"}>Seasons</Link>}
          />
        )}
        {/* Signing in and signing out both live in the header once you have a
            session, so these are only worth offering to signed-out visitors. */}
        {!user && (
          <>
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/login">Log In</Link>}
            />
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/signup">Sign Up</Link>}
            />
          </>
        )}
      </div>
    </div>
  );
}
