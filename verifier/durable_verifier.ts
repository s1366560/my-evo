/**
 * Durable Verifier — checkpoint/resume, result persistence, multi-dimensional validation.
 * Storage: JSON file (primary) + optional Prisma DB (secondary).
 *
 * Checkpoint lifecycle:
 *   task_start() → VERIFYING
 *   task_step()  → PROGRESS (incremental)
 *   task_complete() → COMPLETED + result
 *   task_fail()   → FAILED
 *   task_blocked() → BLOCKED
 *   resume_task() → ResumeResult with can_resume + checkpoint
 *
 * Verification dimensions: completeness | consistency | freshness | preflight
 *
 * Verification modes:
 *   verify_report_dimensions() — returns VerificationResult[] per dimension
 *   verify_report()           — returns overall passed/failed + throws if failed
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import type {
  TaskStatus, StorageBackend, PreflightCheck, VerificationResult,
  CompletionReport, TaskCheckpoint, StoredResult, ResumeResult,
  VerificationContext,
} from './types';

const CHECKPOINT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;
const DEFAULT_CP_DIR = '.verifier_checkpoints';
const DEFAULT_RES_DIR = '.verifier_results';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class VerifierError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 500,
  ) { super(message); this.name = 'VerifierError'; }
}

export class CheckpointNotFoundError extends VerifierError {
  constructor(taskId: string) {
    super(`Checkpoint not found for task: ${taskId}`, 'CHECKPOINT_NOT_FOUND', 404);
  }
}

export class VerificationFailedError extends VerifierError {
  constructor(
    taskId: string,
    public readonly failures: VerificationResult[],
  ) {
    super(
      `Verification failed for task ${taskId}: ${failures.map(f => `${f.dimension}(score=${f.score})`).join('; ')}`,
      'VERIFICATION_FAILED', 422,
    );
  }
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let _prisma: PrismaClient | null = null;
let _cpDir = DEFAULT_CP_DIR;
let _resDir = DEFAULT_RES_DIR;

// ---------------------------------------------------------------------------
// DI setters
// ---------------------------------------------------------------------------

export function setDb(client: PrismaClient): void { _prisma = client; }
export function setCheckpointDir(dir: string): void { _cpDir = dir; }
export function setResultDir(dir: string): void { _resDir = dir; }
export function getCheckpointDir(): string { return _cpDir; }
export function getResultDir(): string { return _resDir; }
export function clearState(): void { _prisma = null; }

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
}

function cpPath(taskId: string): string { return path.join(_cpDir, `${taskId}.json`); }
function resPath(taskId: string): string { return path.join(_resDir, `${taskId}.result.json`); }

function checksum(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Checkpoint file I/O
// ---------------------------------------------------------------------------

export function saveCheckpoint(checkpoint: TaskCheckpoint): TaskCheckpoint {
  ensureDir(_cpDir);
  const payload: TaskCheckpoint = {
    ...checkpoint,
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CHECKPOINT_TTL_MS).toISOString(),
  };
  fs.writeFileSync(cpPath(checkpoint.task_id), JSON.stringify(payload), 'utf-8');
  return payload;
}

export function loadCheckpoint(taskId: string): TaskCheckpoint | null {
  const p = cpPath(taskId);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as TaskCheckpoint;
    if (new Date(raw.expires_at) < new Date()) { fs.unlinkSync(p); return null; }
    return raw;
  } catch { return null; }
}

export function deleteCheckpoint(taskId: string): boolean {
  const p = cpPath(taskId);
  if (fs.existsSync(p)) { fs.unlinkSync(p); return true; }
  return false;
}

export function listCheckpoints(): TaskCheckpoint[] {
  ensureDir(_cpDir);
  const checkpoints: TaskCheckpoint[] = [];
  for (const file of fs.readdirSync(_cpDir).filter(f => f.endsWith('.json'))) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(_cpDir, file), 'utf-8')) as TaskCheckpoint;
      if (new Date(raw.expires_at) >= new Date()) { checkpoints.push(raw); }
    } catch { /* skip */ }
  }
  return checkpoints;
}

export function clearAllCheckpoints(): void {
  if (!fs.existsSync(_cpDir)) return;
  for (const file of fs.readdirSync(_cpDir).filter(f => f.endsWith('.json'))) {
    fs.unlinkSync(path.join(_cpDir, file));
  }
}

// ---------------------------------------------------------------------------
// Result persistence (JSON primary, Prisma optional)
// ---------------------------------------------------------------------------

async function persistResultToDb(stored: StoredResult): Promise<void> {
  if (!_prisma) return;
  const db = _prisma as any;
  if (!db.verifierResult) return; // model may not be in schema
  await db.verifierResult.upsert({
    where: { task_id: stored.task_id },
    create: {
      task_id: stored.task_id,
      status: stored.checkpoint.status,
      report_json: stored.report as any,
      checkpoint_json: stored.checkpoint as any,
      checksum: stored.checksum,
      persisted_at: new Date(stored.persisted_at),
    },
    update: {
      status: stored.checkpoint.status,
      report_json: stored.report as any,
      checkpoint_json: stored.checkpoint as any,
      checksum: stored.checksum,
      persisted_at: new Date(stored.persisted_at),
    },
  });
}

export function saveResult(report: CompletionReport, backend: StorageBackend = 'json'): StoredResult {
  const checkpoint = loadCheckpoint(report.task_id) ?? buildCheckpointFromReport(report);
  const stored: StoredResult = {
    task_id: report.task_id,
    checkpoint,
    report,
    storage_backend: backend,
    persisted_at: new Date().toISOString(),
    checksum: checksum(JSON.stringify({ report, checkpoint })),
  };
  ensureDir(_resDir);
  fs.writeFileSync(resPath(report.task_id), JSON.stringify(stored), 'utf-8');
  if ((backend === 'db' || backend === 'both') && _prisma) {
    persistResultToDb(stored).catch(() => {/* best-effort */});
  }
  return stored;
}

export function loadResult(taskId: string): StoredResult | null {
  const p = resPath(taskId);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) as StoredResult; }
  catch { return null; }
}

export function loadResults(filter?: { status?: TaskStatus; since?: string }): StoredResult[] {
  ensureDir(_resDir);
  const results: StoredResult[] = [];
  for (const file of fs.readdirSync(_resDir).filter(f => f.endsWith('.result.json'))) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(_resDir, file), 'utf-8')) as StoredResult;
      if (filter?.status && r.checkpoint.status !== filter.status) continue;
      if (filter?.since && new Date(r.persisted_at) < new Date(filter.since)) continue;
      results.push(r);
    } catch { /* skip */ }
  }
  return results;
}

export function clearAllResults(): void {
  if (!fs.existsSync(_resDir)) return;
  for (const file of fs.readdirSync(_resDir).filter(f => f.endsWith('.result.json'))) {
    fs.unlinkSync(path.join(_resDir, file));
  }
}

// ---------------------------------------------------------------------------
// Result persistence (JSON primary, Prisma optional)
// ---------------------------------------------------------------------------

async function persistResultToDb(stored: StoredResult): Promise<void> {
  if (!_prisma) return;
  const db = _prisma as any;
  if (!db.verifierResult) return;
  await db.verifierResult.upsert({
    where: { task_id: stored.task_id },
    create: { task_id: stored.task_id, status: stored.checkpoint.status, report_json: stored.report as any, checkpoint_json: stored.checkpoint as any, checksum: stored.checksum, persisted_at: new Date(stored.persisted_at) },
    update: { status: stored.checkpoint.status, report_json: stored.report as any, checkpoint_json: stored.checkpoint as any, checksum: stored.checksum, persisted_at: new Date(stored.persisted_at) },
  });
}

export function saveResult(report: CompletionReport, backend: StorageBackend = 'json'): StoredResult {
  const checkpoint = loadCheckpoint(report.task_id) ?? buildCheckpointFromReport(report);
  const stored: StoredResult = { task_id: report.task_id, checkpoint, report, storage_backend: backend, persisted_at: new Date().toISOString(), checksum: checksum(JSON.stringify({ report, checkpoint })) };
  ensureDir(_resDir);
  fs.writeFileSync(resPath(report.task_id), JSON.stringify(stored), 'utf-8');
  if ((backend === 'db' || backend === 'both') && _prisma) { persistResultToDb(stored).catch(() => {}); }
  return stored;
}

export function loadResult(taskId: string): StoredResult | null {
  const p = resPath(taskId);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) as StoredResult; }
  catch { return null; }
}

export function loadResults(filter?: { status?: TaskStatus; since?: string }): StoredResult[] {
  ensureDir(_resDir);
  const results: StoredResult[] = [];
  for (const file of fs.readdirSync(_resDir).filter(f => f.endsWith('.result.json'))) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(_resDir, file), 'utf-8')) as StoredResult;
      if (filter?.status && r.checkpoint.status !== filter.status) continue;
      if (filter?.since && new Date(r.persisted_at) < new Date(filter.since)) continue;
      results.push(r);
    } catch { /* skip */ }
  }
  return results;
}

export function clearAllResults(): void {
  if (!fs.existsSync(_resDir)) return;
  for (const file of fs.readdirSync(_resDir).filter(f => f.endsWith('.result.json'))) {
    fs.unlinkSync(path.join(_resDir, file));
  }
}
