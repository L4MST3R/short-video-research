import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Plus, TrendingUp, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { Page } from "@/client/components/AppNav";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { useMutation } from "@/client/hooks/useMutation";
import { PLATFORM_LABELS, type PlatformId } from "@/client/lib/format";
import { SyncStatus } from "@/client/components/SyncStatus";
import { addChannel, getWorkspacePage, removeChannel } from "@/serverFunctions/workspaces";

export const Route = createFileRoute("/workspaces/$workspaceId/")({
  loader: ({ params }) => getWorkspacePage({ data: { id: params.workspaceId } }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.workspace.name }] : [] }),
  component: WorkspacePage,
});

const PLATFORM_ITEMS = (Object.keys(PLATFORM_LABELS) as PlatformId[]).map((value) => ({
  value,
  label: PLATFORM_LABELS[value],
}));

function WorkspacePage() {
  const { workspace, channels, youtubeSync } = Route.useLoaderData();
  const { run, pending } = useMutation();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; handle: string } | null>(null);
  const addButton = (
    <Button data-testid="add-channel" onClick={() => setAdding(true)}>
      <Plus data-icon="inline-start" aria-hidden />
      Add channel
    </Button>
  );

  return (
    <Page>
      <PageHeader
        backLink={
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden />
            Workspaces
          </Link>
        }
        title={workspace.name}
        actions={
          <>
            <Button
              variant="outline"
              data-testid="open-feed"
              render={<Link to="/workspaces/$workspaceId/feed" params={{ workspaceId: workspace.id }} />}
            >
              <TrendingUp data-icon="inline-start" aria-hidden />
              Outlier feed
            </Button>
            {channels.length ? addButton : null}
          </>
        }
      />
      {!youtubeSync && channels.some((c) => c.platform === "youtube") ? (
        <Alert data-testid="youtube-off">
          <AlertDescription>
            YouTube sync isn't set up. Add YouTube videos by hand, or ask an admin to turn it on.
          </AlertDescription>
        </Alert>
      ) : null}
      {channels.length === 0 ? (
        <EmptyState
          media="rows"
          icon={Users}
          title="No channels yet"
          description="Add the creators you want to learn from in this niche."
          action={addButton}
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {channels.map((c) => (
            <li key={c.id} data-testid="channel-row" className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <Link to="/channels/$channelId" params={{ channelId: c.id }} className="font-medium hover:underline">
                    {c.handle}
                  </Link>
                  <Badge variant="secondary">{PLATFORM_LABELS[c.platform]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {c.videos} {c.videos === 1 ? "video" : "videos"} ·{" "}
                  <SyncStatus platform={c.platform} lastSyncedAt={c.lastSyncedAt} syncError={c.syncError} />
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${c.handle}`}
                onClick={() => setRemoving({ id: c.id, handle: c.handle })}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {adding ? <AddChannelDialog workspaceId={workspace.id} onClose={() => setAdding(false)} /> : null}
      {removing ? (
        <ConfirmDialog
          title={`Remove ${removing.handle}?`}
          confirmLabel="Remove"
          destructive
          pending={pending}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await run(() => removeChannel({ data: { id: removing.id } }));
            setRemoving(null);
          }}
        >
          Its videos, transcripts and breakdowns are deleted too.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}

function AddChannelDialog({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const { run, pending } = useMutation();
  const [platform, setPlatform] = useState<PlatformId>("youtube");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setError(null);
    const result = await run(() => addChannel({ data: { workspaceId, platform, handle } }));
    if (!result) return;
    if ("error" in result) setError(result.error ?? null);
    else onClose();
  }
  return (
    <FormDialog
      title="Add channel"
      onClose={onClose}
      actions={
        <Button type="submit" form="channel-form" pending={pending} disabled={!handle.trim()}>
          Add channel
        </Button>
      }
    >
      <form
        id="channel-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field>
          <FieldLabel htmlFor="channel-platform">Platform</FieldLabel>
          <SimpleSelect id="channel-platform" testId="channel-platform" items={PLATFORM_ITEMS} value={platform} onChange={setPlatform} />
        </Field>
        <Field>
          <FieldLabel htmlFor="channel-handle">Handle</FieldLabel>
          <Input id="channel-handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@creator" />
        </Field>
        {error ? <FieldError>{error}</FieldError> : null}
      </form>
    </FormDialog>
  );
}
