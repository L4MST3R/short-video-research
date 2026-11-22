import { formatDateTime, type PlatformId } from "@/client/lib/format";

/** A channel's last sync, or its error. */
export function SyncStatus({
  platform,
  lastSyncedAt,
  syncError,
}: {
  platform: PlatformId;
  lastSyncedAt: string | null;
  syncError: string | null;
}) {
  if (platform !== "youtube") return <span>Added by hand</span>;
  return (
    <>
      <span>{lastSyncedAt ? `Synced ${formatDateTime(lastSyncedAt)}` : "Not synced"}</span>
      {syncError ? (
        <span data-testid="sync-error" className="block text-destructive">
          Last sync failed: {syncError}
        </span>
      ) : null}
    </>
  );
}
