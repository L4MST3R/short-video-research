import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderKanban, Plus } from "lucide-react";
import { useState } from "react";
import { Page } from "@/client/components/AppNav";
import { EmptyState } from "@/client/components/EmptyState";
import { NameDialog } from "@/client/components/NameDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { useMutation } from "@/client/hooks/useMutation";
import { createProject, getProjects } from "@/serverFunctions/projects";

export const Route = createFileRoute("/projects/")({
  loader: () => getProjects(),
  head: () => ({ meta: [{ title: "Projects" }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const projects = Route.useLoaderData();
  const { run } = useMutation();
  const [creating, setCreating] = useState(false);
  const newButton = (
    <Button data-testid="new-project" onClick={() => setCreating(true)}>
      <Plus data-icon="inline-start" aria-hidden />
      New project
    </Button>
  );
  return (
    <Page>
      <PageHeader title="Projects" actions={projects.length ? newButton : null} />
      {projects.length === 0 ? (
        <EmptyState
          media="rows"
          icon={FolderKanban}
          title="No projects yet"
          description="Create one, then add videos, hooks and scripts to it from their pages."
          action={newButton}
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {projects.map((p) => (
            <li key={p.id} data-testid="project-row" className="flex items-center gap-3 px-4 py-3">
              <Link to="/projects/$projectId" params={{ projectId: p.id }} className="min-w-0 flex-1 truncate font-medium hover:underline">
                {p.name}
              </Link>
              <span className="text-sm text-muted-foreground">
                {p.items} {p.items === 1 ? "item" : "items"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {creating ? (
        <NameDialog
          title="New project"
          submitLabel="Create"
          onClose={() => setCreating(false)}
          onSubmit={async (name) => Boolean(await run(() => createProject({ data: { name } })))}
        />
      ) : null}
    </Page>
  );
}
