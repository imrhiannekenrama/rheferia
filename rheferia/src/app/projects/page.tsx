import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/projects");

  const supabase = await getSupabaseServerClient();
  if (!supabase) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, description, is_archived, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const list = projects ?? [];

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Projects</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Private containers for saved sources, notes, and reference lists.
        Project creation and member invites arrive with the accounts phase
        follow-up.
      </p>

      {list.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed bg-card p-5 text-sm text-muted-foreground">
          No projects yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {list.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="block rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{project.name}</span>
                  {project.is_archived && <Badge variant="outline">Archived</Badge>}
                </div>
                {project.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
                )}
                <span className="mt-1 block text-xs text-muted-foreground">
                  Created {new Date(project.created_at).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
