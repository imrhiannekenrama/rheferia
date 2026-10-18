import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const supabase = await getSupabaseServerClient();
  if (!supabase) redirect("/login");

  const [profileResult, projectsResult, settingsResult] = await Promise.all([
    supabase.from("profiles").select("display_name, full_name, institution").eq("id", user.id).single(),
    supabase.from("projects").select("id, name, is_archived, created_at").eq("owner_id", user.id).order("created_at", { ascending: false }),
    supabase.from("user_settings").select("default_citation_style, save_search_history").eq("user_id", user.id).single(),
  ]);

  const profile = profileResult.data;
  const projects = projectsResult.data ?? [];
  const settings = settingsResult.data;

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            {profile?.display_name || "Your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-md border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            Sign out
          </button>
        </form>
      </div>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Projects</h2>
          <Link href="/projects" className="text-sm text-primary hover:underline">
            Manage projects →
          </Link>
        </div>
        {projects.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed bg-card p-5 text-sm text-muted-foreground">
            No projects yet. Your first project is created automatically with
            your account.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="block rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <span className="font-medium">{project.name}</span>
                  {project.is_archived && (
                    <Badge variant="outline" className="ml-2">Archived</Badge>
                  )}
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Created {new Date(project.created_at).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Preferences</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <dt className="text-xs font-medium text-muted-foreground uppercase">
              Default citation style
            </dt>
            <dd className="mt-1 text-sm font-medium uppercase">
              {settings?.default_citation_style ?? "apa"}
            </dd>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <dt className="text-xs font-medium text-muted-foreground uppercase">
              Search history
            </dt>
            <dd className="mt-1 text-sm font-medium">
              {settings?.save_search_history
                ? "Saved (private to you)"
                : "Not saved by default"}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          Editing preferences arrives with the accounts phase follow-up;
          the values above reflect your account&apos;s current settings.
        </p>
      </section>
    </main>
  );
}
