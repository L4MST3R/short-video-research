import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Film, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Page } from "@/client/components/AppNav";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { SyncStatus } from "@/client/components/SyncStatus";
import { Button } from "@/client/components/ui/button";
import { Field, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { useMutation } from "@/client/hooks/useMutation";
import { formatDate, formatNumber, PLATFORM_LABELS, toDateInput } from "@/client/lib/format";
import {
  addVideo,
  deleteVideo,
  editVideo,
  getChannelPage,
  syncChannel,
} from "@/serverFunctions/workspaces";

export const Route = createFileRoute("/channels/$channelId")({
  loader: ({ params }) => getChannelPage({ data: { id: params.channelId } }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.channel.handle }] : [] }),
  component: ChannelPage,
});

type VideoRow = Awaited<ReturnType<typeof getChannelPage>>["videos"][number];

function ChannelPage() {
  const { channel, videos, youtubeSync } = Route.useLoaderData();
  const { run, pending } = useMutation();
  const [editing, setEditing] = useState<VideoRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<VideoRow | null>(null);
  const canSync = channel.platform === "youtube" && youtubeSync;
  const addButton = (
    <Button data-testid="add-video" onClick={() => setEditing("new")}>
      <Plus data-icon="inline-start" aria-hidden />
      Add video
    </Button>
  );

  return (
    <Page>
      <PageHeader
        backLink={
          <Link
            to="/workspaces/$workspaceId"
            params={{ workspaceId: channel.workspaceId }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {channel.workspaceName}
          </Link>
        }
        title={channel.handle}
        description={
          <>
            {PLATFORM_LABELS[channel.platform]} ·{" "}
            <SyncStatus platform={channel.platform} lastSyncedAt={channel.lastSyncedAt} syncError={channel.syncError} />
          </>
        }
        actions={
          <>
            {canSync ? (
              <Button variant="outline" pending={pending} onClick={() => run(() => syncChannel({ data: { id: channel.id } }))}>
                <RefreshCw data-icon="inline-start" aria-hidden />
                Sync now
              </Button>
            ) : null}
            {videos.length ? addButton : null}
          </>
        }
      />
      {videos.length === 0 ? (
        <EmptyState
          media="rows"
          icon={Film}
          title="No videos yet"
          description={
            canSync
              ? "Sync to bring in this channel's recent shorts, or add videos by hand."
              : "Add this creator's videos by hand with their views, likes and comments."
          }
          action={addButton}
        />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Video</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Likes</TableHead>
                <TableHead className="text-right">Comments</TableHead>
                <TableHead>Posted</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos.map((v) => (
                <TableRow key={v.id} data-testid="video-row">
                  <TableCell className="max-w-64 truncate">
                    <Link to="/videos/$videoId" params={{ videoId: v.id }} className="font-medium hover:underline">
                      {v.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(v.views)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(v.likes)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(v.comments)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(v.postedAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${v.title}`} onClick={() => setEditing(v)}>
                      <Pencil aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${v.title}`} onClick={() => setDeleting(v)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {editing ? (
        <VideoDialog channelId={channel.id} video={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.title}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await run(() => deleteVideo({ data: { id: deleting.id } }));
            setDeleting(null);
          }}
        >
          Its transcript and breakdown are deleted too.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}

function VideoDialog({ channelId, video, onClose }: { channelId: string; video: VideoRow | null; onClose: () => void }) {
  const { run, pending } = useMutation();
  const [form, setForm] = useState({
    url: video?.url ?? "",
    title: video?.title ?? "",
    views: String(video?.views ?? ""),
    likes: String(video?.likes ?? ""),
    comments: String(video?.comments ?? ""),
    posted: video ? toDateInput(video.postedAt) : new Date().toISOString().slice(0, 10),
  });
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: event.target.value }));
  async function submit() {
    const fields = {
      url: form.url,
      title: form.title,
      views: Number(form.views || 0),
      likes: Number(form.likes || 0),
      comments: Number(form.comments || 0),
      posted: form.posted,
    };
    const saved = await run(() =>
      video ? editVideo({ data: { id: video.id, ...fields } }) : addVideo({ data: { channelId, ...fields } }),
    );
    if (saved) onClose();
  }
  const number = (key: "views" | "likes" | "comments", label: string) => (
    <Field>
      <FieldLabel htmlFor={`video-${key}`}>{label}</FieldLabel>
      <Input id={`video-${key}`} type="number" min={0} inputMode="numeric" value={form[key]} onChange={set(key)} />
    </Field>
  );
  return (
    <FormDialog
      title={video ? "Edit video" : "Add video"}
      onClose={onClose}
      actions={
        <Button type="submit" form="video-form" pending={pending} disabled={!form.url.trim() || !form.title.trim()}>
          Save
        </Button>
      }
    >
      <form
        id="video-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field>
          <FieldLabel htmlFor="video-url">URL</FieldLabel>
          <Input id="video-url" type="url" value={form.url} onChange={set("url")} placeholder="https://" />
        </Field>
        <Field>
          <FieldLabel htmlFor="video-title">Title</FieldLabel>
          <Input id="video-title" value={form.title} onChange={set("title")} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          {number("views", "Views")}
          {number("likes", "Likes")}
          {number("comments", "Comments")}
        </div>
        <Field>
          <FieldLabel htmlFor="video-posted">Posted</FieldLabel>
          <Input id="video-posted" type="date" value={form.posted} onChange={set("posted")} />
        </Field>
      </form>
    </FormDialog>
  );
}
