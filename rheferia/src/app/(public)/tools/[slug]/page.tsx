import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTool } from "@/lib/conversions/tool-registry";
import { appEnvConfig } from "@/lib/config/env";
import { Badge } from "@/components/ui/badge";
import { ToolWorkbench } from "@/components/tools/tool-workbench";
import { CloudConverterForm, CloudNotConfigured } from "@/components/tools/cloud-converter-form";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  return {
    title: tool ? tool.name : "Tool not found",
    description: tool?.purpose,
  };
}

export default async function ToolPage({ params }: PageProps) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  const env = appEnvConfig();
  const cloudConfigured = Boolean(process.env.CLOUDCONVERT_API_KEY?.trim());


  return (
    <main id="main-content" className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link href="/tools" className="text-sm text-muted-foreground hover:text-foreground">
        ← All tools
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{tool.name}</h1>
        <Badge variant={tool.execution === "browser" ? "success" : "secondary"}>
          {tool.execution === "browser" ? "Processed on your device" : "Cloud converter"}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{tool.purpose}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Input: {tool.inputs.join(", ")} · Output: {tool.output}
      </p>
      {tool.notes && (
        <p className="mt-3 rounded-md border bg-card p-3 text-xs text-muted-foreground">
          {tool.notes}
        </p>
      )}

      {/* The real workbench for browser tools; honest capability state
          for cloud tools when the provider is not configured. */}
      {tool.execution === "browser" ? (
        <ToolWorkbench tool={tool} />
      ) : cloudConfigured ? (
        <CloudConverterForm
          tool={tool}
          limits={{
            maxUploadMiB: env.maxCloudUploadMiB,
            dailyConversions: env.maxDailyCloudConversions,
            retentionHours: env.tempFileRetentionHours,
          }}
        />
      ) : (
        <CloudNotConfigured />
      )}
    </main>
  );
}
