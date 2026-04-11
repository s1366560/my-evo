import { PrismaClient } from '@prisma/client';
import type {
  SearchQuery,
  SearchResult,
  AutocompleteResult,
  SearchableAsset,
} from '../shared/types';
import {
  NAME_EXACT_SCORE,
  NAME_PARTIAL_SCORE,
  DESCRIPTION_SCORE,
  SIGNAL_SCORE,
  TAG_SCORE,
  GDI_BOOST_DIVISOR,
  DOWNLOAD_BOOST_DIVISOR,
  SEARCH_SIMILARITY_THRESHOLD,
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
} from '../shared/constants';
import { ValidationError } from '../shared/errors';

let prisma = new PrismaClient();
const PUBLIC_SEARCH_STATUSES = new Set(['published', 'promoted']);

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function computeRelevance(
  asset: {
    name: string;
    description: string;
    signals: string[];
    tags: string[];
    gdi_score: number;
    downloads: number;
  },
  query: string,
): number {
  const lowerQuery = query.toLowerCase();
  const lowerName = asset.name.toLowerCase();
  const lowerDesc = asset.description.toLowerCase();

  let score = 0;

  if (lowerName === lowerQuery) {
    score += NAME_EXACT_SCORE;
  } else if (lowerName.includes(lowerQuery)) {
    score += NAME_PARTIAL_SCORE;
  }

  if (lowerDesc.includes(lowerQuery)) {
    score += DESCRIPTION_SCORE;
  }

  const hasSignal = asset.signals.some((s) =>
    s.toLowerCase().includes(lowerQuery),
  );
  if (hasSignal) {
    score += SIGNAL_SCORE;
  }

  const hasTag = asset.tags.some((t) =>
    t.toLowerCase().includes(lowerQuery),
  );
  if (hasTag) {
    score += TAG_SCORE;
  }

  score += asset.gdi_score / GDI_BOOST_DIVISOR;
  score += asset.downloads / DOWNLOAD_BOOST_DIVISOR;

  return score;
}

function toSearchableAsset(
  record: Record<string, unknown>,
): SearchableAsset {
  return {
    id: record.asset_id as string,
    type: record.asset_type as 'gene' | 'capsule' | 'skill',
    name: record.name as string,
    description: record.description as string,
    signals: record.signals as string[],
    tags: record.tags as string[],
    author_id: record.author_id as string,
    gdi_score: record.gdi_score as number,
    downloads: record.downloads as number,
    rating: record.rating as number,
    created_at: (record.created_at as Date).toISOString(),
    updated_at: (record.updated_at as Date).toISOString(),
    metadata: (record.config as Record<string, unknown>) ?? {},
  };
}

export async function search(query: SearchQuery): Promise<SearchResult> {
  const startMs = Date.now();
  const limit = Math.min(
    query.limit ?? DEFAULT_SEARCH_LIMIT,
    MAX_SEARCH_LIMIT,
  );
  const offset = query.offset ?? 0;

  if (query.status && !PUBLIC_SEARCH_STATUSES.has(query.status)) {
    throw new ValidationError('status must be published or promoted');
  }

  const where: Record<string, unknown> = {
    status: query.status ?? 'published',
  };

  if (query.type) {
    where.asset_type = query.type;
  }
  if (query.signals && query.signals.length > 0) {
    where.signals = { hasSome: query.signals };
  }
  if (query.tags && query.tags.length > 0) {
    where.tags = { hasSome: query.tags };
  }
  if (query.min_gdi !== undefined) {
    where.gdi_score = { gte: query.min_gdi };
  }
  if (query.author_id) {
    where.author_id = query.author_id;
  }

  const assets = await prisma.asset.findMany({
    where,
    orderBy: { gdi_score: 'desc' },
    take: MAX_SEARCH_LIMIT,
  });

  const scored = assets
    .map((a: { name: string; description: string; signals: string[]; tags: string[]; gdi_score: number; downloads: number; [key: string]: unknown }) => ({
      asset: a as Record<string, unknown>,
      score: computeRelevance(a, query.q),
    }))
    .filter((s: { score: number }) => s.score > 0)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

  const paged = scored.slice(offset, offset + limit);
  const items = paged.map((s: { asset: Record<string, unknown> }) => toSearchableAsset(s.asset));

  const byType: Record<string, number> = {};
  const bySignal: Record<string, number> = {};
  for (const s of scored) {
    const a = s.asset;
    const t = a.asset_type as string;
    byType[t] = (byType[t] ?? 0) + 1;
    for (const sig of s.asset.signals as string[]) {
      bySignal[sig] = (bySignal[sig] ?? 0) + 1;
    }
  }

  return {
    items,
    total: scored.length,
    facets: { by_type: byType, by_signal: bySignal },
    query_time_ms: Date.now() - startMs,
  };
}

export async function autocomplete(
  prefix: string,
  type?: 'gene' | 'capsule' | 'skill',
): Promise<AutocompleteResult> {
  const where: Record<string, unknown> = {
    status: 'published',
    name: { contains: prefix, mode: 'insensitive' },
  };
  if (type) {
    where.asset_type = type;
  }

  const assets = await prisma.asset.findMany({
    where,
    select: { name: true, signals: true, tags: true },
    take: 20,
  });

  const nameSuggestions = assets.map((a: { name: string }) => ({
    text: a.name,
    type: 'name' as const,
    score: NAME_EXACT_SCORE,
  }));

  const signalSet = new Set<string>();
  const tagSet = new Set<string>();
  for (const a of assets) {
    for (const s of a.signals) {
      if (s.toLowerCase().startsWith(prefix.toLowerCase())) {
        signalSet.add(s);
      }
    }
    for (const t of a.tags) {
      if (t.toLowerCase().startsWith(prefix.toLowerCase())) {
        tagSet.add(t);
      }
    }
  }

  const signalSuggestions = [...signalSet].map((s) => ({
    text: s,
    type: 'signal' as const,
    score: SIGNAL_SCORE,
  }));

  const tagSuggestions = [...tagSet].map((t) => ({
    text: t,
    type: 'tag' as const,
    score: TAG_SCORE,
  }));

  const suggestions = [
    ...nameSuggestions,
    ...signalSuggestions,
    ...tagSuggestions,
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return { suggestions };
}

export async function trending(
  limit = 20,
): Promise<SearchableAsset[]> {
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  );

  const assets = await prisma.asset.findMany({
    where: {
      status: 'published',
      created_at: { gte: thirtyDaysAgo },
    },
    orderBy: [{ downloads: 'desc' }, { gdi_score: 'desc' }],
    take: limit,
  });

  return assets.map((a: Record<string, unknown>) =>
    toSearchableAsset(a),
  );
}

export async function findSimilar(
  assetId: string,
  threshold = SEARCH_SIMILARITY_THRESHOLD,
): Promise<Array<{ asset: SearchableAsset; similarity: number }>> {
  const source = await prisma.asset.findUnique({
    where: { asset_id: assetId },
  });

  if (!source) {
    return [];
  }

  const candidates = await prisma.asset.findMany({
    where: {
      asset_id: { not: assetId },
      status: 'published',
    },
  });

  const results: Array<{ asset: SearchableAsset; similarity: number }> = [];

  for (const candidate of candidates) {
    const sourceSignals = new Set(source.signals);
    const candidateSignals = new Set(candidate.signals);
    const intersection = new Set(
      [...sourceSignals].filter((s) => candidateSignals.has(s)),
    );
    const union = new Set([...sourceSignals, ...candidateSignals]);

    const jaccard =
      union.size === 0 ? 0 : intersection.size / union.size;

    if (jaccard >= threshold) {
      results.push({
        asset: toSearchableAsset(
          candidate as unknown as Record<string, unknown>,
        ),
        similarity: jaccard,
      });
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity).slice(0, 20);
}

export async function reindex(assetId: string): Promise<void> {
  const asset = await prisma.asset.findUnique({
    where: { asset_id: assetId },
  });

  if (!asset) {
    return;
  }

  await prisma.asset.update({
    where: { asset_id: assetId },
    data: { updated_at: new Date() },
  });
}
