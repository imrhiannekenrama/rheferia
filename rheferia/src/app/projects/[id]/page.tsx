import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await getCurrentUser();
  const supabase = await getSupabaseServerClient();
  if (!user || !supabase) return { title: "Project" };
  const { data } = await supabase
    .from("projects")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  return { title: data?.name ?? "Project" };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/projects/${id}`);

  const supabase = await getSupabaseServerClient();
  if (!supabase) redirect("/login");

  // RLS scopes reads: owner or member.
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, description, is_archived, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  const { data: sources } = await supabase
    .from("saved_sources")
    .select("id, title, year, access_status, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const sourceList = sources ?? [];

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground">
        ← All projects
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{project.name}</h1>
        {project.is_archived && <Badge variant="outline">Archived</Badge>}
      </div>
      {project.description && (
        <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
      )}

      <section className="mt-8">
        <h2 className="font-semibold">Saved sources</h2>
        {sourceList.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed bg-card p-5 text-sm text-muted-foreground">
            No sources saved to this project yet. Search, then use{" "}
            <span className="font-medium text-foreground">Save to project</span>{" "}
            on a result. (The save action arrives with the accounts phase
            follow-up.)
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {sourceList.map((source) => (
              <li key={source.id} className="rounded-lg border bg-card p-4">
                <span className="font-medium">{source.title}</span>
                {source.year != null && (
                  <span className="text-muted-foreground"> ({source.year})</span>
                )}
                <Badge variant="outline" className="ml-2">{source.access_status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
