import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AddToProject } from "@/client/components/AddToProject";
import { AiUnavailable } from "@/client/components/AiUnavailable";
import { Page } from "@/client/components/AppNav";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { FormDialog } from "@/client/components/FormDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Field, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { useMutation } from "@/client/hooks/useMutation";
import { blanksOf, fillTemplate } from "@/server/templates";
import { CATEGORIES, type Category } from "@/shared/constants";
import {
  createTemplate,
  deleteHook,
  deleteTemplate,
  editHook,
  editTemplate,
  generateHooks,
  getHooksPage,
  saveHook,
} from "@/serverFunctions/hooks";

export const Route = createFileRoute("/hooks")({
  loader: () => getHooksPage(),
  head: () => ({ meta: [{ title: "Hooks" }] }),
  component: HooksPage,
});

type Data = Awaited<ReturnType<typeof getHooksPage>>;
type Template = Data["templates"][number];
type Hook = Data["saved"][number];

const categoryLabel = (c: string) => CATEGORIES[c as Category] ?? c;
const CATEGORY_ITEMS = (Object.keys(CATEGORIES) as Category[]).map((value) => ({ value, label: CATEGORIES[value] }));
const FILTER_ITEMS = [{ value: "all", label: "All categories" }, ...CATEGORY_ITEMS] as const;

function HooksPage() {
  const { templates, saved, projects, admin } = Route.useLoaderData();
  const { run, pending } = useMutation();
  const [topic, setTopic] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [generated, setGenerated] = useState<string[]>([]);
  const [unavailable, setUnavailable] = useState<{ setup: string | null } | null>(null);
  const [filling, setFilling] = useState<Template | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | "new" | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);
  const [editingHook, setEditingHook] = useState<Hook | null>(null);
  const [deletingHook, setDeletingHook] = useState<Hook | null>(null);
  const shown = useMemo(
    () => (category === "all" ? templates : templates.filter((t) => t.category === category)),
    [templates, category],
  );

  async function generate() {
    setUnavailable(null);
    const result = await run(() => generateHooks({ data: { topic, templateIds: picked } }));
    if (!result) return;
    if (result.ok) setGenerated(result.value);
    else if (result.unavailable) setUnavailable({ setup: result.setup });
    else toast.error(result.message);
  }

  async function keep(text: string) {
    const savedHook = await run(() => saveHook({ data: { text, topic } }));
    if (savedHook) {
      setGenerated((list) => list.filter((h) => h !== text));
      toast.success("Hook saved");
    }
  }

  return (
    <Page>
      <PageHeader title="Hooks" />

      <Card>
        <CardHeader>
          <CardTitle>Generate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field>
            <FieldLabel htmlFor="hook-topic">Topic</FieldLabel>
            <Input id="hook-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Meal prep for night-shift nurses" />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              data-testid="generate-hooks"
              pending={pending}
              disabled={!topic.trim() || picked.length === 0}
              onClick={generate}
            >
              <Sparkles data-icon="inline-start" aria-hidden />
              Generate hooks
            </Button>
            <span className="text-sm text-muted-foreground">
              {picked.length === 0 ? "Pick templates below." : `${picked.length} ${picked.length === 1 ? "template" : "templates"} picked`}
            </span>
          </div>
          {unavailable ? <AiUnavailable what="Hook generation" setup={unavailable.setup} /> : null}
          {generated.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {generated.map((text) => (
                <li key={text} data-testid="generated-hook" className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="flex-1">{text}</span>
                  <Button size="sm" variant="outline" onClick={() => keep(text)}>
                    Save
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Saved hooks</h2>
        {saved.length === 0 ? (
          <EmptyState size="sm" title="No saved hooks" description="Generate hooks or fill in a template, then save the ones you like." />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {saved.map((h) => (
              <li key={h.id} data-testid="hook-row" className="flex flex-wrap items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{h.text}</p>
                  {h.topic ? <p className="text-xs text-muted-foreground">{h.topic}</p> : null}
                </div>
                <AddToProject kind="hook" refId={h.id} projects={projects} size="sm" />
                <Button variant="ghost" size="icon-sm" aria-label="Edit hook" onClick={() => setEditingHook(h)}>
                  <Pencil aria-hidden />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Delete hook" onClick={() => setDeletingHook(h)}>
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Templates</h2>
          <div className="flex items-center gap-2">
            <SimpleSelect ariaLabel="Category" items={FILTER_ITEMS} value={category} onChange={setCategory} />
            {admin ? (
              <Button data-testid="add-template" variant="outline" onClick={() => setEditingTemplate("new")}>
                <Plus data-icon="inline-start" aria-hidden />
                Add template
              </Button>
            ) : null}
          </div>
        </div>
        {shown.length === 0 ? (
          <EmptyState size="sm" kind="filtered" title="No templates in this category" />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {shown.map((t) => (
              <li key={t.id} data-testid="template-row" className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Checkbox
                  aria-label="Pick for generating"
                  checked={picked.includes(t.id)}
                  onCheckedChange={(checked) =>
                    setPicked((list) => (checked ? [...list, t.id] : list.filter((id) => id !== t.id)))
                  }
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm">{t.text}</p>
                  <Badge variant="secondary">{categoryLabel(t.category)}</Badge>
                </div>
                <Button size="sm" variant="outline" onClick={() => setFilling(t)}>
                  Fill in
                </Button>
                {admin ? (
                  <>
                    <Button variant="ghost" size="icon-sm" aria-label="Edit template" onClick={() => setEditingTemplate(t)}>
                      <Pencil aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Delete template" onClick={() => setDeletingTemplate(t)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {filling ? <FillDialog template={filling} topic={topic} onClose={() => setFilling(null)} /> : null}
      {editingTemplate ? (
        <TemplateDialog template={editingTemplate === "new" ? null : editingTemplate} onClose={() => setEditingTemplate(null)} />
      ) : null}
      {deletingTemplate ? (
        <ConfirmDialog
          title="Delete this template?"
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeletingTemplate(null)}
          onConfirm={async () => {
            await run(() => deleteTemplate({ data: { id: deletingTemplate.id } }));
            setPicked((list) => list.filter((id) => id !== deletingTemplate.id));
            setDeletingTemplate(null);
          }}
        >
          It's removed for every member.
        </ConfirmDialog>
      ) : null}
      {editingHook ? <HookDialog hook={editingHook} onClose={() => setEditingHook(null)} /> : null}
      {deletingHook ? (
        <ConfirmDialog
          title="Delete this hook?"
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeletingHook(null)}
          onConfirm={async () => {
            await run(() => deleteHook({ data: { id: deletingHook.id } }));
            setDeletingHook(null);
          }}
        />
      ) : null}
    </Page>
  );
}

function FillDialog({ template, topic: initialTopic, onClose }: { template: Template; topic: string; onClose: () => void }) {
  const { run, pending } = useMutation();
  const blanks = blanksOf(template.text);
  const [values, setValues] = useState<Record<string, string>>({});
  const [topic, setTopic] = useState(initialTopic);
  const preview = fillTemplate(template.text, values);
  return (
    <FormDialog
      title="Fill in template"
      onClose={onClose}
      actions={
        <Button
          pending={pending}
          onClick={async () => {
            const saved = await run(() => saveHook({ data: { text: preview, topic, templateId: template.id } }));
            if (saved) {
              toast.success("Hook saved");
              onClose();
            }
          }}
        >
          Save hook
        </Button>
      }
    >
      <div className="space-y-4">
        {blanks.map((blank, index) => (
          <Field key={blank}>
            <FieldLabel htmlFor={`blank-${index}`}>{blank}</FieldLabel>
            <Input
              id={`blank-${index}`}
              value={values[blank] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [blank]: e.target.value }))}
            />
          </Field>
        ))}
        <Field>
          <FieldLabel htmlFor="fill-topic">Topic</FieldLabel>
          <Input id="fill-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Optional" />
        </Field>
        <p data-testid="hook-preview" className="rounded-lg bg-muted px-3 py-2 text-sm">
          {preview}
        </p>
      </div>
    </FormDialog>
  );
}

function TemplateDialog({ template, onClose }: { template: Template | null; onClose: () => void }) {
  const { run, pending } = useMutation();
  const [text, setText] = useState(template?.text ?? "");
  const [category, setCategory] = useState<Category>((template?.category as Category | undefined) ?? "contrarian");
  return (
    <FormDialog
      title={template ? "Edit template" : "Add template"}
      onClose={onClose}
      actions={
        <Button
          pending={pending}
          disabled={!text.trim()}
          onClick={async () => {
            const saved = await run(() =>
              template
                ? editTemplate({ data: { id: template.id, text, category } })
                : createTemplate({ data: { text, category } }),
            );
            if (saved) onClose();
          }}
        >
          Save
        </Button>
      }
    >
      <div className="space-y-4">
        <Field>
          <FieldLabel htmlFor="template-text">Template</FieldLabel>
          <Textarea id="template-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Stop [habit]. Do [better habit] instead." />
          <p className="text-xs text-muted-foreground">Put each blank in square brackets.</p>
        </Field>
        <Field>
          <FieldLabel htmlFor="template-category">Category</FieldLabel>
          <SimpleSelect id="template-category" testId="template-category" items={CATEGORY_ITEMS} value={category} onChange={setCategory} />
        </Field>
      </div>
    </FormDialog>
  );
}

function HookDialog({ hook, onClose }: { hook: Hook; onClose: () => void }) {
  const { run, pending } = useMutation();
  const [text, setText] = useState(hook.text);
  return (
    <FormDialog
      title="Edit hook"
      onClose={onClose}
      actions={
        <Button
          pending={pending}
          disabled={!text.trim()}
          onClick={async () => {
            const saved = await run(() => editHook({ data: { id: hook.id, text } }));
            if (saved) onClose();
          }}
        >
          Save
        </Button>
      }
    >
      <Field>
        <FieldLabel htmlFor="hook-text">Hook</FieldLabel>
        <Textarea id="hook-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
    </FormDialog>
  );
}
