type Counts = { periods: unknown[]; goals: unknown[] };

function hasRecords(snapshot: Counts) {
  return snapshot.periods.length > 0 || snapshot.goals.length > 0;
}

export function syncAction(local: Counts, remote: Counts | null, localHash: string, remoteHash: string | null, base: string | null) {
  if (!remote) return hasRecords(local) ? "upload" : "empty";
  if (localHash === remoteHash) return "synced";
  if (!hasRecords(local) && hasRecords(remote)) return "restore";
  if (hasRecords(local) && !hasRecords(remote)) {
    return base === remoteHash ? "upload" : "conflict";
  }
  if (!hasRecords(local) && !base) return "restore";
  if (base === localHash) return "restore";
  if (base === remoteHash) return "upload";
  return "conflict";
}
