import type { SyncCheckpoint, SyncStep } from './types';

interface CheckpointStore {
  [syncId: string]: SyncCheckpoint;
}

let checkpointStore: CheckpointStore = {};

export function saveCheckpoint(
  syncId: string,
  position: number,
  total: number,
  step: SyncStep,
  lastAssetId?: string,
): SyncCheckpoint {
  const checkpoint: SyncCheckpoint = {
    sync_id: syncId,
    position,
    total,
    last_asset_id: lastAssetId,
    step,
    created_at: new Date().toISOString(),
  };

  checkpointStore[syncId] = checkpoint;

  return checkpoint;
}

export function loadCheckpoint(syncId: string): SyncCheckpoint | null {
  return checkpointStore[syncId] || null;
}

export async function resumeInterruptedSync(
  syncId: string,
): Promise<{
  can_resume: boolean;
  checkpoint?: SyncCheckpoint;
  message: string;
}> {
  const checkpoint = checkpointStore[syncId];

  if (!checkpoint) {
    return {
      can_resume: false,
      message: `No checkpoint found for sync ${syncId}`,
    };
  }

  const createdAt = new Date(checkpoint.created_at);
  const now = new Date();
  const ageMs = now.getTime() - createdAt.getTime();
  const maxAgeMs = 24 * 60 * 60 * 1000;

  if (ageMs > maxAgeMs) {
    clearCheckpoint(syncId);
    return {
      can_resume: false,
      message: `Checkpoint for ${syncId} has expired (age: ${Math.round(ageMs / 3600000)}h)`,
    };
  }

  if (checkpoint.position >= checkpoint.total) {
    clearCheckpoint(syncId);
    return {
      can_resume: false,
      message: `Sync ${syncId} already completed`,
    };
  }

  return {
    can_resume: true,
    checkpoint,
    message: `Resuming sync ${syncId} from position ${checkpoint.position}/${checkpoint.total}`,
  };
}

export function clearCheckpoint(syncId: string): boolean {
  if (checkpointStore[syncId]) {
    delete checkpointStore[syncId];
    return true;
  }
  return false;
}

export async function getInterruptedSyncs(): Promise<SyncCheckpoint[]> {
  const now = new Date();
  const maxAgeMs = 24 * 60 * 60 * 1000;

  const interrupted: SyncCheckpoint[] = [];

  for (const syncId of Object.keys(checkpointStore)) {
    const checkpoint = checkpointStore[syncId];
    if (checkpoint) {
      const ageMs = now.getTime() - new Date(checkpoint.created_at).getTime();
      if (checkpoint.position < checkpoint.total && ageMs <= maxAgeMs) {
        interrupted.push(checkpoint);
      }
    }
  }

  return interrupted;
}

export function clearAllCheckpoints(): void {
  checkpointStore = {};
}
