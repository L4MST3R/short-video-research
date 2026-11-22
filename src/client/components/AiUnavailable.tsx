import { Alert, AlertDescription, AlertTitle } from "@/client/components/ui/alert";

/** Shown when the Gateway refuses an AI call, with what to set up when it says. */
export function AiUnavailable({ what, setup }: { what: string; setup: string | null }) {
  return (
    <Alert data-testid="ai-unavailable">
      <AlertTitle>{what} is unavailable</AlertTitle>
      <AlertDescription>{setup ?? "AI isn't set up for this app. An admin can add an OpenRouter key to the Gateway."}</AlertDescription>
    </Alert>
  );
}
