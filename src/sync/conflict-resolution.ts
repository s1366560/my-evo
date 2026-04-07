import type {
  ChangeVersion,
  ConflictRecord,
  ConflictStrategy,
} from './types';

export interface ConflictDetectionResult {
  has_conflicts: boolean;
  conflicts: ConflictRecord[];
}

export function detectConflicts(
  local: Record<string, ChangeVersion>,
  remote: Record<string, ChangeVersion>,
): ConflictDetectionResult {
  const conflicts: ConflictRecord[] = [];

  const localKeys = Object.keys(local);
  const remoteKeys = Object.keys(remote);
  const allKeys = [...localKeys, ...remoteKeys].filter(
    (key, index, arr) => arr.indexOf(key) === index
  );

  for (const assetId of allKeys) {
    const localVersion = local[assetId];
    const remoteVersion = remote[assetId];

    if (!localVersion || !remoteVersion) continue;

    if (localVersion.content_hash !== remoteVersion.content_hash &&
        localVersion.version === remoteVersion.version) {
      conflicts.push({
        asset_id: assetId,
        local_version: localVersion,
        remote_version: remoteVersion,
        detected_at: new Date().toISOString(),
        strategy: 'last_write_wins',
      });
    }
  }

  return {
    has_conflicts: conflicts.length > 0,
    conflicts,
  };
}

export function resolveByLastWriteWins(
  local: ChangeVersion,
  remote: ChangeVersion,
): ChangeVersion {
  const localTime = new Date(local.updated_at).getTime();
  const remoteTime = new Date(remote.updated_at).getTime();
  return localTime >= remoteTime ? local : remote;
}

export function resolveByNodePriority(
  local: ChangeVersion,
  remote: ChangeVersion,
  localPriority: number = 50,
  remotePriority: number = 50,
): ChangeVersion {
  return localPriority >= remotePriority ? local : remote;
}

export function mergeChanges<T extends Record<string, unknown>>(
  local: T,
  remote: T,
  preferRemote: boolean = true,
): T {
  const merged: Record<string, unknown> = {};

  const localKeys = Object.keys(local as Record<string, unknown>);
  const remoteKeys = Object.keys(remote as Record<string, unknown>);
  const allKeys = [...localKeys, ...remoteKeys].filter(
    (key, index, arr) => arr.indexOf(key) === index
  );

  for (const key of allKeys) {
    const localVal = (local as Record<string, unknown>)[key];
    const remoteVal = (remote as Record<string, unknown>)[key];

    if (localVal === undefined) {
      merged[key] = remoteVal;
    } else if (remoteVal === undefined) {
      merged[key] = localVal;
    } else if (typeof localVal === 'object' && typeof remoteVal === 'object') {
      merged[key] = mergeChanges(
        localVal as Record<string, unknown>,
        remoteVal as Record<string, unknown>,
        preferRemote,
      );
    } else if (preferRemote) {
      merged[key] = remoteVal;
    } else {
      merged[key] = localVal;
    }
  }

  return merged as T;
}

export function applyConflictResolution(
  conflicts: ConflictRecord[],
  strategy: ConflictStrategy,
  localPriority?: number,
  remotePriority?: number,
): Record<string, ChangeVersion> {
  const resolved: Record<string, ChangeVersion> = {};

  for (const conflict of conflicts) {
    switch (strategy) {
      case 'last_write_wins':
        resolved[conflict.asset_id] = resolveByLastWriteWins(
          conflict.local_version,
          conflict.remote_version,
        );
        break;

      case 'node_priority':
        resolved[conflict.asset_id] = resolveByNodePriority(
          conflict.local_version,
          conflict.remote_version,
          localPriority ?? 50,
          remotePriority ?? 50,
        );
        break;

      case 'merge':
        resolved[conflict.asset_id] = resolveByLastWriteWins(
          conflict.local_version,
          conflict.remote_version,
        );
        break;
    }
  }

  return resolved;
}
