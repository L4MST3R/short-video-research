import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Page } from "@/client/components/AppNav";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Field, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { useMutation } from "@/client/hooks/useMutation";
import { formatDate } from "@/client/lib/format";
import { FRAMEWORKS, type Framework } from "@/shared/constants";
import { createScript, getScriptsPage } from "@/serverFunctions/scripts";

export const Route = createFileRoute("/scripts/")({
  // `from`: a video to start the new script from.
  validateSearch: z.object({ from: z.string().max(64).optional().catch(undefined) }),
  loader: () => getScriptsPage(),
  head: () => ({ meta: [{ title: "Scripts" }] }),
  component: ScriptsPage,
});

const FRAMEWORK_ITEMS = (Object.keys(FRAMEWORKS) as Framework[]).map((value) => ({ value, label: FRAMEWORKS[value].label }));
const frameworkLabel = (f: string) => FRAMEWORKS[f as Framework]?.label ?? f;

function ScriptsPage() {
  const { scripts, videos } = Route.useLoaderData();
  const { from } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [creating, setCreating] = useState(Boolean(from));
  const newButton = (
    <Button data-testid="new-script" onClick={() => setCreating(true)}>
      <Plus data-icon="inline-start" aria-hidden />
      New script
    </Button>
  );
  return (
    <Page>
      <PageHeader title="Scripts" actions={scripts.length ? newButton : null} />
      {scripts.length === 0 ? (
        <EmptyState
          media="rows"
          icon={FileText}
          title="No scripts yet"
          description="Start one from an idea, or from a video's page."
          action={newButton}
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {scripts.map((s) => (
            <li key={s.id} data-testid="script-row" className="flex items-center gap-3 px-4 py-3">
              <Link to="/scripts/$scriptId" params={{ scriptId: s.id }} className="min-w-0 flex-1 truncate font-medium hover:underline">
                {s.title}
              </Link>
              <Badge variant="secondary">{frameworkLabel(s.framework)}</Badge>
              <span className="hidden text-sm text-muted-foreground sm:inline">{formatDate(s.updatedAt)}</span>
            </li>
          ))}
        </ul>
      )}
      {creating ? (
        <NewScriptDialog
          videos={videos}
          from={videos.some((v) => v.id === from) ? from! : "none"}
          onClose={() => {
            setCreating(false);
            if (from) void navigate({ search: {}, replace: true });
          }}
        />
      ) : null}
    </Page>
  );
}

function NewScriptDialog({
  videos,
  from,
  onClose,
}: {
  videos: { id: string; title: string; handle: string }[];
  from: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { run, pending } = useMutation();
  const source = videos.find((v) => v.id === from);
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [framework, setFramework] = useState<Framework>("hook-problem-solution");
  const [sourceVideoId, setSourceVideoId] = useState(from);
  const sourceItems = [{ value: "none", label: "None" }, ...videos.map((v) => ({ value: v.id, label: v.title }))];
  async function submit() {
    const created = await run(() =>
      createScript({ data: { title, idea, framework, sourceVideoId: sourceVideoId === "none" ? null : sourceVideoId } }),
    );
    if (created) await navigate({ to: "/scripts/$scriptId", params: { scriptId: created.id } });
  }
  return (
    <FormDialog
      title={source ? `New script from “${source.title}”` : "New script"}
      onClose={onClose}
      actions={
        <Button type="submit" form="script-form" pending={pending} disabled={!title.trim()}>
          Create
        </Button>
      }
    >
      <form
        id="script-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field>
          <FieldLabel htmlFor="script-title">Title</FieldLabel>
          <Input id="script-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="script-idea">Idea</FieldLabel>
          <Textarea id="script-idea" rows={3} value={idea} onChange={(e) => setIdea(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="script-framework">Framework</FieldLabel>
          <SimpleSelect id="script-framework" testId="script-framework" items={FRAMEWORK_ITEMS} value={framework} onChange={setFramework} />
        </Field>
        <Field>
          <FieldLabel htmlFor="script-source">Source video</FieldLabel>
          <SimpleSelect id="script-source" testId="script-source" items={sourceItems} value={sourceVideoId} onChange={setSourceVideoId} />
        </Field>
      </form>
    </FormDialog>
  );
}
