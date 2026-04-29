import { PrismaClient } from '@prisma/client';
import type { ExportJob, ExportFilters, ExportColumn, ExportFieldMapping } from './types';
import {
  EXPORT_MAX_RECORDS,
  EXPORT_JOB_TTL_HOURS,
  EXPORT_FORMATS,
  EXPORT_ENTITIES,
} from './constants';
import { ValidationError } from '../shared/errors';

let prisma = new PrismaClient();
export function setPrisma(client: PrismaClient): void { prisma = client; }
function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const FIELD_MAPPINGS: ExportFieldMapping = {
  asset: {
    csv: [
      { field: 'asset_id', header: 'Asset ID', type: 'string' },
      { field: 'name', header: 'Name', type: 'string', width: 200 },
      { field: 'description', header: 'Description', type: 'string', width: 300 },
      { field: 'asset_type', header: 'Type', type: 'string' },
      { field: 'status', header: 'Status', type: 'string' },
      { field: 'author_id', header: 'Author ID', type: 'string' },
      { field: 'gdi_score', header: 'GDI Score', type: 'number', align: 'right' },
      { field: 'downloads', header: 'Downloads', type: 'number', align: 'right' },
      { field: 'rating', header: 'Rating', type: 'number', align: 'right' },
      { field: 'carbon_cost', header: 'Carbon Cost', type: 'number', align: 'right' },
      { field: 'created_at', header: 'Created At', type: 'date' },
    ],
    json: [
      { field: 'asset_id', header: 'Asset ID', type: 'string' },
      { field: 'name', header: 'Name', type: 'string' },
      { field: 'description', header: 'Description', type: 'string' },
      { field: 'asset_type', header: 'Type', type: 'string' },
      { field: 'status', header: 'Status', type: 'string' },
      { field: 'signals', header: 'Signals', type: 'array' },
      { field: 'tags', header: 'Tags', type: 'array' },
      { field: 'author_id', header: 'Author ID', type: 'string' },
      { field: 'gdi_score', header: 'GDI Score', type: 'number' },
      { field: 'downloads', header: 'Downloads', type: 'number' },
      { field: 'rating', header: 'Rating', type: 'number' },
      { field: 'carbon_cost', header: 'Carbon Cost', type: 'number' },
      { field: 'created_at', header: 'Created At', type: 'date' },
    ],
    xlsx: [
      { field: 'asset_id', header: 'Asset ID', type: 'string' },
      { field: 'name', header: 'Name', type: 'string', width: 200 },
      { field: 'asset_type', header: 'Type', type: 'string' },
      { field: 'status', header: 'Status', type: 'string' },
      { field: 'gdi_score', header: 'GDI Score', type: 'number' },
      { field: 'downloads', header: 'Downloads', type: 'number' },
      { field: 'created_at', header: 'Created At', type: 'date' },
    ],
    xml: [
      { field: 'asset_id', header: 'Asset ID', type: 'string' },
      { field: 'name', header: 'Name', type: 'string' },
      { field: 'description', header: 'Description', type: 'string' },
      { field: 'asset_type', header: 'Type', type: 'string' },
      { field: 'status', header: 'Status', type: 'string' },
      { field: 'gdi_score', header: 'GDI Score', type: 'number' },
      { field: 'created_at', header: 'Created At', type: 'date' },
    ],
  },
  node: {
    csv: [
      { field: 'node_id', header: 'Node ID', type: 'string' },
      { field: 'model', header: 'Model', type: 'string' },
      { field: 'status', header: 'Status', type: 'string' },
      { field: 'reputation', header: 'Reputation', type: 'number', align: 'right' },
      { field: 'credit_balance', header: 'Credit Balance', type: 'number', align: 'right' },
      { field: 'last_seen', header: 'Last Seen', type: 'date' },
      { field: 'registered_at', header: 'Registered At', type: 'date' },
    ],
    json: [
      { field: 'node_id', header: 'Node ID', type: 'string' },
      { field: 'model', header: 'Model', type: 'string' },
      { field: 'status', header: 'Status', type: 'string' },
      { field: 'reputation', header: 'Reputation', type: 'number' },
      { field: 'credit_balance', header: 'Credit Balance', type: 'number' },
      { field: 'last_seen', header: 'Last Seen', type: 'date' },
      { field: 'registered_at', header: 'Registered At', type: 'date' },
    ],
    xlsx: [
      { field: 'node_id', header: 'Node ID', type: 'string' },
      { field: 'model', header: 'Model', type: 'string' },
      { field: 'status', header: 'Status', type: 'string' },
      { field: 'reputation', header: 'Reputation', type: 'number' },
      { field: 'credit_balance', header: 'Credit Balance', type: 'number' },
      { field: 'last_seen', header: 'Last Seen', type: 'date' },
    ],
    xml: [
      { field: 'node_id', header: 'Node ID', type: 'string' },
      { field: 'model', header: 'Model', type: 'string' },
      { field: 'status', header: 'Status', type: 'string' },
      { field: 'reputation', header: 'Reputation', type: 'number' },
      { field: 'last_seen', header: 'Last Seen', type: 'date' },
    ],
  },
  gene: { csv: [], json: [], xlsx: [], xml: [] },
  capsule: { csv: [], json: [], xlsx: [], xml: [] },
  recipe: { csv: [], json: [], xlsx: [], xml: [] },
  user: { csv: [], json: [], xlsx: [], xml: [] },
  transaction: { csv: [], json: [], xlsx: [], xml: [] },
};

const jobs = new Map<string, ExportJob>();

export async function createExportJob(
  params: {
    user_id: string; entity_type: string; format: string;
    filters?: ExportFilters; delivery?: string; delivery_target?: string;
    compression?: 'none' | 'gzip' | 'zip';
  },
  client?: PrismaClient,
): Promise<ExportJob> {
  const db = client ?? prisma;
  if (!EXPORT_FORMATS.includes(params.format as 'csv' | 'json' | 'xlsx' | 'xml')) {
    throw new ValidationError(`format must be one of: ${EXPORT_FORMATS.join(', ')}`);
  }
  if (!EXPORT_ENTITIES.includes(params.entity_type as 'asset' | 'node' | 'gene' | 'capsule' | 'recipe' | 'user' | 'transaction')) {
    throw new ValidationError(`entity_type must be one of: ${EXPORT_ENTITIES.join(', ')}`);
  }
  const job: ExportJob = {
    job_id: genId('exp'), user_id: params.user_id,
    entity_type: params.entity_type as ExportJob['entity_type'],
    format: params.format as ExportJob['format'],
    filters: params.filters ?? {}, status: 'pending',
    record_count: 0, file_size_bytes: 0,
    delivery: (params.delivery ?? 'download') as ExportJob['delivery'],
    delivery_target: params.delivery_target,
    created_at: new Date().toISOString(),
    compression: params.compression ?? 'none',
  };
  jobs.set(job.job_id, job);
  return job;
}

export function getExportJob(jobId: string): ExportJob | null { return jobs.get(jobId) ?? null; }

export function getUserExportJobs(userId: string): ExportJob[] {
  return Array.from(jobs.values()).filter(j => j.user_id === userId);
}

export function updateExportJob(
  jobId: string,
  updates: Partial<Pick<ExportJob, 'status' | 'record_count' | 'file_size_bytes' | 'file_path' | 'download_url' | 'error_message'>>,
): ExportJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  const updated = { ...job, ...updates };
  if (updates.status === 'processing' && !updated.started_at) updated.started_at = new Date().toISOString();
  if (updates.status === 'completed') {
    updated.completed_at = new Date().toISOString();
    const expiry = new Date(); expiry.setHours(expiry.getHours() + EXPORT_JOB_TTL_HOURS);
    updated.expires_at = expiry.toISOString();
  }
  jobs.set(jobId, updated);
  return updated;
}

export function listExportJobs(
  filters?: { user_id?: string; status?: string; entity_type?: string; date_from?: string; date_to?: string },
  pagination?: { page: number; page_size: number },
): { jobs: ExportJob[]; total: number } {
  let all = Array.from(jobs.values());
  if (filters?.user_id) all = all.filter(j => j.user_id === filters.user_id);
  if (filters?.status) all = all.filter(j => j.status === filters.status);
  if (filters?.entity_type) all = all.filter(j => j.entity_type === filters.entity_type);
  if (filters?.date_from) all = all.filter(j => j.created_at >= filters.date_from!);
  if (filters?.date_to) all = all.filter(j => j.created_at <= filters.date_to!);
  all.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = all.length;
  const page = pagination?.page ?? 1;
  const size = pagination?.page_size ?? 20;
  return { jobs: all.slice((page - 1) * size, page * size), total };
}

export async function cancelExportJob(jobId: string): Promise<ExportJob> {
  const job = jobs.get(jobId);
  if (!job) throw new ValidationError(`Job not found: ${jobId}`);
  if (!['pending', 'processing'].includes(job.status)) throw new ValidationError(`Cannot cancel job in status: ${job.status}`);
  const updated = { ...job, status: 'cancelled' as const };
  jobs.set(jobId, updated);
  return updated;
}

export function deleteExportJob(jobId: string): boolean { return jobs.delete(jobId); }

export function getExportColumns(entityType: string, format: string): ExportColumn[] {
  const m = FIELD_MAPPINGS[entityType as keyof ExportFieldMapping];
  if (!m) return [];
  return (m as Record<string, ExportColumn[]>)[format] ?? [];
}

export async function queryExportRecords(
  entityType: string, filters: ExportFilters, client?: PrismaClient,
): Promise<{ records: Record<string, unknown>[]; total: number }> {
  const db = client ?? prisma;
  const where: Record<string, unknown> = {};
  if (filters.status?.length) where.status = { in: filters.status };
  if (filters.asset_type?.length) where.asset_type = { in: filters.asset_type };
  if (filters.signals?.length) where.signals = { hasSome: filters.signals };
  if (filters.tags?.length) where.tags = { hasSome: filters.tags };
  if (filters.author_id) where.author_id = filters.author_id;
  if (filters.node_id) where.node_id = filters.node_id;
  if (filters.min_gdi !== undefined) where.gdi_score = { gte: filters.min_gdi };
  if (filters.max_gdi !== undefined) where.gdi_score = { ...(where.gdi_score as object ?? {}), lte: filters.max_gdi };
  if (filters.date_from) where.created_at = { ...(where.created_at as object ?? {}), gte: new Date(filters.date_from) };
  if (filters.date_to) where.created_at = { ...(where.created_at as object ?? {}), lte: new Date(filters.date_to) };
  if (filters.search_query) {
    where.OR = [
      { name: { contains: filters.search_query, mode: 'insensitive' } },
      { description: { contains: filters.search_query, mode: 'insensitive' } },
    ];
  }

  if (entityType === 'asset' || entityType === 'gene' || entityType === 'capsule' || entityType === 'recipe') {
    const [records, count] = await Promise.all([
      db.asset.findMany({ where, take: EXPORT_MAX_RECORDS, orderBy: { created_at: 'desc' } }),
      db.asset.count({ where }),
    ]);
    return { records: records as Record<string, unknown>[], total: count };
  } else if (entityType === 'node') {
    const [records, count] = await Promise.all([
      db.node.findMany({ where, take: EXPORT_MAX_RECORDS }),
      db.node.count({ where }),
    ]);
    return { records: records as Record<string, unknown>[], total: count };
  } else {
    throw new ValidationError(`Unsupported entity type: ${entityType}`);
  }
}

export function generateCsv(records: Record<string, unknown>[], columns: ExportColumn[]): string {
  const cols = columns.filter(c => !c.hidden);
  const escape = (v: unknown) => { if (v === null || v === undefined) return '""'; const s = typeof v === 'object' ? JSON.stringify(v) : String(v); return `"${s.replace(/"/g, '""')}"`; };
  const header = cols.map(c => `"${c.header}"`).join(',');
  const rows = records.map(r => cols.map(col => escape(r[col.field])).join(','));
  return [header, ...rows].join('\n');
}

export function generateJson(records: Record<string, unknown>[], columns: ExportColumn[]): string {
  const cols = columns.filter(c => !c.hidden);
  const projected = records.map(r => {
    const out: Record<string, unknown> = {};
    for (const c of cols) out[c.field] = r[c.field];
    return out;
  });
  return JSON.stringify(projected, null, 2);
}

export function generateXml(records: Record<string, unknown>[], columns: ExportColumn[], entityType: string): string {
  const cols = columns.filter(c => !c.hidden);
  const escape = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const items = records.map(r => {
    const fields = cols.map(c => `    <${c.field}>${escape(r[c.field])}</${c.field}>`).join('\n');
    return `  <${entityType}>\n${fields}\n  </${entityType}>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<export>\n${items}\n</export>`;
}

export async function runExportJob(jobId: string, client?: PrismaClient): Promise<ExportJob> {
  const job = jobs.get(jobId);
  if (!job) throw new ValidationError('Job not found');
  updateExportJob(jobId, { status: 'processing' });
  try {
    const { records, total } = await queryExportRecords(job.entity_type, job.filters, client);
    const columns = getExportColumns(job.entity_type, job.format);
    let content: string;
    let fileExt: string;
    switch (job.format) {
      case 'csv': content = generateCsv(records as Record<string, unknown>[], columns); fileExt = 'csv'; break;
      case 'json': content = generateJson(records as Record<string, unknown>[], columns); fileExt = 'json'; break;
      case 'xml': content = generateXml(records as Record<string, unknown>[], columns, job.entity_type); fileExt = 'xml'; break;
      default: content = JSON.stringify(records); fileExt = 'json';
    }
    updateExportJob(jobId, {
      status: 'completed', record_count: total,
      file_size_bytes: Buffer.byteLength(content, 'utf8'),
      file_path: `/exports/${jobId}.${fileExt}`,
      download_url: `/exports/${jobId}.${fileExt}`,
    });
  } catch (err) {
    updateExportJob(jobId, { status: 'failed', error_message: String(err) });
  }
  return jobs.get(jobId)!;
}

export function _resetTestState(): void { jobs.clear(); }
