import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Page } from "@/client/components/AppNav";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { NameDialog } from "@/client/components/NameDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { useMutation } from "@/client/hooks/useMutation";
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspaces,
  renameWorkspace,
} from "@/serverFunctions/workspaces";

export const Route = createFileRoute("/")({
  loader: () => getWorkspaces(),
  component: Workspaces,
});

type Dialog =
  | { kind: "create" }
  | { kind: "rename"; id: string; name: string }
  | { kind: "delete"; id: string; name: string }
  | null;

function Workspaces() {
  const workspaces = Route.useLoaderData();
  const navigate = useNavigate();
  const { run, pending } = useMutation();
  const [dialog, setDialog] = useState<Dialog>(null);
  const newButton = (
    <Button data-testid="new-workspace" onClick={() => setDialog({ kind: "create" })}>
      <Plus data-icon="inline-start" aria-hidden />
      New workspace
    </Button>
  );

  return (
    <Page>
      <PageHeader title="Workspaces" actions={workspaces.length ? newButton : null} />
      {workspaces.length === 0 ? (
        <EmptyState
          media="rows"
          icon={FolderOpen}
          title="No workspaces yet"
          description="Create one for a niche, then add the creators you follow in it."
          action={newButton}
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {workspaces.map((w) => (
            <li key={w.id} data-testid="workspace-row" className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  to="/workspaces/$workspaceId"
                  params={{ workspaceId: w.id }}
                  className="font-medium hover:underline"
                >
                  {w.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {w.channels} {w.channels === 1 ? "channel" : "channels"} · {w.videos}{" "}
                  {w.videos === 1 ? "video" : "videos"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Rename ${w.name}`}
                onClick={() => setDialog({ kind: "rename", id: w.id, name: w.name })}
              >
                <Pencil aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${w.name}`}
                onClick={() => setDialog({ kind: "delete", id: w.id, name: w.name })}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {dialog?.kind === "create" ? (
        <NameDialog
          title="New workspace"
          submitLabel="Create"
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            const created = await run(() => createWorkspace({ data: { name } }));
            if (!created) return false;
            await navigate({ to: "/workspaces/$workspaceId", params: { workspaceId: created.id } });
            return true;
          }}
        />
      ) : null}
      {dialog?.kind === "rename" ? (
        <NameDialog
          title="Rename workspace"
          initial={dialog.name}
          submitLabel="Save"
          onClose={() => setDialog(null)}
          onSubmit={async (name) => Boolean(await run(() => renameWorkspace({ data: { id: dialog.id, name } })))}
        />
      ) : null}
      {dialog?.kind === "delete" ? (
        <ConfirmDialog
          title={`Delete ${dialog.name}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await run(() => deleteWorkspace({ data: { id: dialog.id } }));
            setDialog(null);
          }}
        >
          Its channels, videos, transcripts and breakdowns are deleted too.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}
