import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Expand, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddToProject } from "@/client/components/AddToProject";
import { AiUnavailable } from "@/client/components/AiUnavailable";
import { Page } from "@/client/components/AppNav";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { CopyButton } from "@/client/components/CopyButton";
import { PageHeader } from "@/client/components/PageHeader";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { Button } from "@/client/components/ui/button";
import { Field, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { useMutation } from "@/client/hooks/useMutation";
import { errorMessage } from "@/client/lib/format";
import { FRAMEWORKS, type Framework } from "@/shared/constants";
import { deleteScript, draftScript, getScriptPage, updateScript } from "@/serverFunctions/scripts";

export const Route = createFileRoute("/scripts/$scriptId")({
  loader: ({ params }) => getScriptPage({ data: { id: params.scriptId } }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.script.title }] : [] }),
  component: ScriptPage,
});

const FRAMEWORK_ITEMS = (Object.keys(FRAMEWORKS) as Framework[]).map((value) => ({ value, label: FRAMEWORKS[value].label }));

function ScriptPage() {
  const { script, projects } = Route.useLoaderData();
  // Keyed so a reload after saving starts from what was saved.
  return <ScriptEditor key={`${script.id}-${script.updatedAt}`} script={script} projects={projects} />;
}

function ScriptEditor({
  script,
  projects,
}: {
  script: Awaited<ReturnType<typeof getScriptPage>>["script"];
  projects: { id: string; name: string }[];
}) {
  const navigate = useNavigate();
  const save = useMutation();
  const ai = useMutation();
  const [form, setForm] = useState({
    title: script.title,
    idea: script.idea,
    framework: script.framework as Framework,
    hook: script.hook,
    body: script.body,
    cta: script.cta,
  });
  const [unavailable, setUnavailable] = useState<{ setup: string | null } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const set = (key: "title" | "idea" | "hook" | "body" | "cta") =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: event.target.value }));
  const hasDraft = Boolean(form.hook.trim() || form.body.trim() || form.cta.trim());

  async function write(mode: "draft" | "expand") {
    setUnavailable(null);
    const result = await ai.run(() =>
      draftScript({ data: { id: script.id, mode, idea: form.idea, framework: form.framework, hook: form.hook, body: form.body, cta: form.cta } }),
    );
    if (!result) return;
    if (result.ok) {
      setForm((f) => ({ ...f, ...result.value }));
      toast.success(mode === "draft" ? "Draft written. Save to keep it." : "Draft expanded. Save to keep it.");
    } else if (result.unavailable) setUnavailable({ setup: result.setup });
    else toast.error(result.message);
  }

  return (
    <Page>
      <PageHeader
        backLink={
          <Link to="/scripts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden />
            Scripts
          </Link>
        }
        title={script.title}
        description={
          script.source ? (
            <>
              From{" "}
              <Link to="/videos/$videoId" params={{ videoId: script.source.id }} className="underline">
                {script.source.title}
              </Link>
            </>
          ) : null
        }
        actions={
          <>
            <AddToProject kind="script" refId={script.id} projects={projects} />
            <Button variant="outline" onClick={() => setDeleting(true)}>
              <Trash2 data-icon="inline-start" aria-hidden />
              Delete script
            </Button>
          </>
        }
      />
      <div className="space-y-4">
        <Field>
          <FieldLabel htmlFor="script-title">Title</FieldLabel>
          <Input id="script-title" value={form.title} onChange={set("title")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="script-idea">Idea</FieldLabel>
          <Textarea id="script-idea" rows={2} value={form.idea} onChange={set("idea")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="script-framework">Framework</FieldLabel>
          <SimpleSelect
            id="script-framework"
            items={FRAMEWORK_ITEMS}
            value={form.framework}
            onChange={(framework) => setForm((f) => ({ ...f, framework }))}
            className="w-full sm:w-72"
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button data-testid="draft-script" variant="outline" pending={ai.pending} onClick={() => write("draft")}>
            <Sparkles data-icon="inline-start" aria-hidden />
            Draft with AI
          </Button>
          <Button data-testid="expand-script" variant="outline" disabled={!hasDraft || ai.pending} onClick={() => write("expand")}>
            <Expand data-icon="inline-start" aria-hidden />
            Expand
          </Button>
        </div>
        {unavailable ? <AiUnavailable what="AI writing" setup={unavailable.setup} /> : null}
        <Field>
          <FieldLabel htmlFor="script-hook">Hook</FieldLabel>
          <Textarea id="script-hook" rows={2} value={form.hook} onChange={set("hook")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="script-body">Body</FieldLabel>
          <Textarea id="script-body" rows={10} value={form.body} onChange={set("body")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="script-cta">Call to action</FieldLabel>
          <Textarea id="script-cta" rows={2} value={form.cta} onChange={set("cta")} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            data-testid="save-script"
            pending={save.pending}
            disabled={!form.title.trim()}
            onClick={async () => {
              const saved = await save.run(() => updateScript({ data: { id: script.id, ...form } }));
              if (saved) toast.success("Script saved");
              else if (saved === null) toast.error("This script no longer exists.");
            }}
          >
            Save
          </Button>
          <CopyButton
            value={[form.hook, form.body, form.cta].filter((part) => part.trim()).join("\n\n")}
            successMessage="Script copied"
            size="default"
          />
        </div>
      </div>
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${script.title}?`}
          confirmLabel="Delete"
          destructive
                    onClose={() => setDeleting(false)}
          onConfirm={async () => {
            try {
              await deleteScript({ data: { id: script.id } });
              await navigate({ to: "/scripts" });
            } catch (error) {
              toast.error(errorMessage(error));
              setDeleting(false);
            }
          }}
        />
      ) : null}
    </Page>
  );
}
