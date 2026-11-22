import { useState } from "react";
import { FormDialog } from "@/client/components/FormDialog";
import { Button } from "@/client/components/ui/button";
import { Field, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";

/** A dialog with one Name field, for creating or renaming. */
export function NameDialog({
  title,
  initial = "",
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  initial?: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const [pending, setPending] = useState(false);
  async function submit() {
    if (!name.trim()) return;
    setPending(true);
    const done = await onSubmit(name.trim());
    setPending(false);
    if (done) onClose();
  }
  return (
    <FormDialog
      title={title}
      onClose={onClose}
      actions={
        <Button type="submit" form="name-form" pending={pending} disabled={!name.trim()}>
          {submitLabel}
        </Button>
      }
    >
      <form
        id="name-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field>
          <FieldLabel htmlFor="name-input">Name</FieldLabel>
          <Input id="name-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={120} />
        </Field>
      </form>
    </FormDialog>
  );
}
