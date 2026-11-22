import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Page } from "@/client/components/AppNav";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { NameDialog } from "@/client/components/NameDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { useMutation } from "@/client/hooks/useMutation";
import { errorMessage } from "@/client/lib/format";
import { deleteProject, getProjectPage, removeFromProject, renameProject } from "@/serverFunctions/projects";

export const Route = createFileRoute("/projects/$projectId")({
  loader: ({ params }) => getProjectPage({ data: { id: params.projectId } }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.name }] : [] }),
  component: ProjectPage,
});

type Item = { id: string; refId: string; note: string; label: string };

function ProjectPage() {
  const project = Route.useLoaderData();
  const navigate = useNavigate();
  const { run } = useMutation();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const empty = !project.videos.length && !project.hooks.length && !project.scripts.length;
  const remove = (id: string) => run(() => removeFromProject({ data: { id } }));

  return (
    <Page>
      <PageHeader
        backLink={
          <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden />
            Projects
          </Link>
        }
        title={project.name}
        actions={
          <>
            <Button variant="outline" onClick={() => setRenaming(true)}>
              <Pencil data-icon="inline-start" aria-hidden />
              Rename
            </Button>
            <Button variant="outline" onClick={() => setDeleting(true)}>
              <Trash2 data-icon="inline-start" aria-hidden />
              Delete project
            </Button>
          </>
        }
      />
      {empty ? (
        <EmptyState
          title="Nothing in this project yet"
          description="Use “Add to project” on a video, hook or script."
          action={<Button render={<Link to="/" />}>Workspaces</Button>}
        />
      ) : null}
      <Group kind="video" title="Videos" items={project.videos} onRemove={remove} />
      <Group kind="hook" title="Hooks" items={project.hooks} onRemove={remove} />
      <Group kind="script" title="Scripts" items={project.scripts} onRemove={remove} />
      {renaming ? (
        <NameDialog
          title="Rename project"
          initial={project.name}
          submitLabel="Save"
          onClose={() => setRenaming(false)}
          onSubmit={async (name) => Boolean(await run(() => renameProject({ data: { id: project.id, name } })))}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${project.name}?`}
          confirmLabel="Delete"
          destructive
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            try {
              await deleteProject({ data: { id: project.id } });
              await navigate({ to: "/projects" });
            } catch (error) {
              toast.error(errorMessage(error));
              setDeleting(false);
            }
          }}
        >
          The videos, hooks and scripts in it are kept.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}

function Group({
  kind,
  title,
  items,
  onRemove,
}: {
  kind: "video" | "hook" | "script";
  title: string;
  items: Item[];
  onRemove: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <section data-testid={`project-group-${kind}`} className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {items.map((item) => (
          <li key={item.id} data-testid="project-item" className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              {kind === "video" ? (
                <Link to="/videos/$videoId" params={{ videoId: item.refId }} className="font-medium hover:underline">
                  {item.label}
                </Link>
              ) : kind === "script" ? (
                <Link to="/scripts/$scriptId" params={{ scriptId: item.refId }} className="font-medium hover:underline">
                  {item.label}
                </Link>
              ) : (
                <Link to="/hooks" className="hover:underline">
                  {item.label}
                </Link>
              )}
              {item.note ? <p className="text-sm text-muted-foreground">{item.note}</p> : null}
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Remove from project" onClick={() => onRemove(item.id)}>
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
