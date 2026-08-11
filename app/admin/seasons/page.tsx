import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { deleteSeason, openRegistration } from "./actions";

export default async function AdminSeasonsPage() {
  const supabase = await createClient();

  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, name, status, season_weeks(count), season_tiers(count), teams(count)")
    .order("id", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Seasons</h1>
        <Link href="/admin/seasons/new" className={buttonVariants()}>
          Create a season
        </Link>
      </div>

      {(seasons ?? []).length === 0 && (
        <p className="text-muted-foreground">No seasons yet.</p>
      )}

      <ul className="flex flex-col gap-3">
        {(seasons ?? []).map((season) => (
          <li
            key={season.id}
            className="flex items-center justify-between gap-4 rounded-lg border p-4"
          >
            <div>
              <p className="font-medium">{season.name}</p>
              <p className="text-sm text-muted-foreground">
                {season.status} · {season.season_weeks[0]?.count ?? 0} weeks ·{" "}
                {season.season_tiers[0]?.count ?? 0} tiers
              </p>
            </div>

            <div className="flex items-center gap-2">
              {season.status === "draft" && (
                <form action={openRegistration}>
                  <input type="hidden" name="seasonId" value={season.id} />
                  <Button type="submit" variant="outline">
                    Open registration
                  </Button>
                </form>
              )}

              {/* Only empty seasons; a registered team makes delete unsafe. */}
              {(season.teams[0]?.count ?? 0) === 0 && (
                <form action={deleteSeason}>
                  <input type="hidden" name="seasonId" value={season.id} />
                  <Button type="submit" variant="ghost">
                    Delete
                  </Button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}