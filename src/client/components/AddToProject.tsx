import { Link } from "@tanstack/react-router";
import { FolderPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/client/components/FormDialog";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { Button } from "@/client/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { errorMessage } from "@/client/lib/format";
import { addToProject } from "@/serverFunctions/projects";

/** A button that adds a video, hook or script to one of the member's projects. */
export function AddToProject({
  kind,
  refId,
  projects,
  size = "default",
}: {
  kind: "video" | "hook" | "script";
  refId: string;
  projects: { id: string; name: string }[];
  size?: "default" | "sm" | "xs";
}) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function add() {
    setPending(true);
    setError(null);
    try {
      const result = await addToProject({ data: { projectId, kind, refId, note } });
      if (!result) setError("That project or item no longer exists.");
      else if (result.result === "duplicate") setError("Already in this project.");
      else {
        toast.success(`Added to ${result.project}`);
        setOpen(false);
        setNote("");
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)}>
        <FolderPlus data-icon="inline-start" aria-hidden />
        Add to project
      </Button>
      {open ? (
        <FormDialog
          title="Add to project"
          onClose={() => setOpen(false)}
          actions={
            projects.length ? (
              <Button onClick={add} pending={pending} disabled={!projectId}>
                Add
              </Button>
            ) : (
              <Button render={<Link to="/projects" />}>Go to projects</Button>
            )
          }
        >
          {projects.length ? (
            <div className="space-y-4">
              <Field>
                <FieldLabel htmlFor="project-select">Project</FieldLabel>
                <SimpleSelect
                  id="project-select"
                  testId="project-select"
                  items={projects.map((p) => ({ value: p.id, label: p.name }))}
                  value={projectId}
                  onChange={(value) => {
                    setProjectId(value);
                    setError(null);
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="project-note">Note</FieldLabel>
                <Input id="project-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
              </Field>
              {error ? <FieldError>{error}</FieldError> : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          )}
        </FormDialog>
      ) : null}
    </>
  );
}
