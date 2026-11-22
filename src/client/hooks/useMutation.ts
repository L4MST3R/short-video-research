import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/client/lib/format";

/**
 * Runs a change, then reloads the route's data. A thrown error becomes a
 * toast; `run` resolves to the change's result, or undefined when it failed.
 */
export function useMutation() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function run<T>(work: () => Promise<T>): Promise<T | undefined> {
    setPending(true);
    try {
      const result = await work();
      await router.invalidate();
      return result;
    } catch (error) {
      toast.error(errorMessage(error));
      return undefined;
    } finally {
      setPending(false);
    }
  }
  return { pending, run };
}
