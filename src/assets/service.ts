/**
 * Assets Module Service
 * Business logic for asset publishing and management
 */

import type { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type {
  Asset,
  CreateAssetInput,
  UpdateAssetInput,
  ListAssetsInput,
  PublishAssetInput,
  AssetCategory,
} from './types';
import { ASSET_CATEGORIES } from './types';

export async function createAsset(
  prisma: PrismaClient,
  authorId: string,
  input: CreateAssetInput
): Promise<Asset> {
  const asset = await prisma.asset.create({
    data: {
      asset_id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      asset_type: input.asset_type,
      name: input.name,
      description: input.description,
      content: input.content || null,
      signals: input.signals || [],
      tags: input.tags || [],
      author_id: authorId,
      status: 'draft',
      gene_ids: input.gene_ids?.join(',') || null,
      parent_id: input.parent_id || null,
      ancestors: input.parent_id ? [input.parent_id] : [],
      generation: input.parent_id ? 1 : 0,
      config: (input.config || {}) as Prisma.InputJsonValue,
    },
  });

  return asset as unknown as Asset;
}

export async function getAsset(
  prisma: PrismaClient,
  assetId: string
): Promise<Asset | null> {
  const asset = await prisma.asset.findUnique({
    where: { asset_id: assetId },
  });

  return asset as unknown as Asset | null;
}

export async function updateAsset(
  prisma: PrismaClient,
  assetId: string,
  authorId: string,
  input: UpdateAssetInput
): Promise<Asset | null> {
  // Verify ownership
  const existing = await prisma.asset.findUnique({
    where: { asset_id: assetId },
  });

  if (!existing || existing.author_id !== authorId) {
    return null;
  }

  const updateData: Prisma.AssetUpdateInput = {};
  if (input.name) updateData.name = input.name;
  if (input.description) updateData.description = input.description;
  if (input.content !== undefined) updateData.content = input.content;
  if (input.signals) updateData.signals = input.signals;
  if (input.tags) updateData.tags = input.tags;
  if (input.config) updateData.config = input.config as Prisma.InputJsonValue;
  if (input.status) updateData.status = input.status;

  const asset = await prisma.asset.update({
    where: { asset_id: assetId },
    data: updateData,
  });

  return asset as unknown as Asset;
}

export async function deleteAsset(
  prisma: PrismaClient,
  assetId: string,
  authorId: string
): Promise<boolean> {
  // Verify ownership
  const existing = await prisma.asset.findUnique({
    where: { asset_id: assetId },
  });

  if (!existing || existing.author_id !== authorId) {
    return false;
  }

  await prisma.asset.delete({
    where: { asset_id: assetId },
  });

  return true;
}

export async function listAssets(
  prisma: PrismaClient,
  input: ListAssetsInput
): Promise<{ assets: Asset[]; total: number }> {
  const where: Prisma.AssetWhereInput = {};

  if (input.asset_type) {
    where.asset_type = input.asset_type;
  }

  if (input.status) {
    where.status = input.status;
  }

  if (input.author_id) {
    where.author_id = input.author_id;
  }

  if (input.tags && input.tags.length > 0) {
    where.tags = { hasSome: input.tags };
  }

  if (input.search) {
    where.OR = [
      { name: { contains: input.search, mode: 'insensitive' } },
      { description: { contains: input.search, mode: 'insensitive' } },
    ];
  }

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      take: input.limit || 50,
      skip: input.offset || 0,
      orderBy: { created_at: 'desc' },
    }),
    prisma.asset.count({ where }),
  ]);

  return {
    assets: assets as unknown as Asset[],
    total,
  };
}

export async function publishAsset(
  prisma: PrismaClient,
  assetId: string,
  authorId: string,
  _input?: PublishAssetInput
): Promise<Asset | null> {
  // Verify ownership
  const existing = await prisma.asset.findUnique({
    where: { asset_id: assetId },
  });

  if (!existing || existing.author_id !== authorId) {
    return null;
  }

  const asset = await prisma.asset.update({
    where: { asset_id: assetId },
    data: {
      status: 'published',
      last_verified_at: new Date(),
    },
  });

  return asset as unknown as Asset;
}

export async function forkAsset(
  prisma: PrismaClient,
  assetId: string,
  newAuthorId: string,
  newName?: string
): Promise<Asset | null> {
  const original = await prisma.asset.findUnique({
    where: { asset_id: assetId },
  });

  if (!original) {
    return null;
  }

  // Increment fork count on original
  await prisma.asset.update({
    where: { asset_id: assetId },
    data: { fork_count: { increment: 1 } },
  });

  // Create forked asset
  const forked = await prisma.asset.create({
    data: {
      asset_id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      asset_type: original.asset_type,
      name: newName || `${original.name} (Fork)`,
      description: original.description,
      content: original.content,
      signals: original.signals,
      tags: original.tags,
      author_id: newAuthorId,
      status: 'draft',
      gene_ids: original.gene_ids,
      parent_id: assetId,
      ancestors: [...original.ancestors, assetId],
      generation: original.generation + 1,
      config: original.config as Prisma.InputJsonValue ?? undefined,
    },
  });

  return forked as unknown as Asset;
}

export async function getAssetCategories(
  prisma: PrismaClient
): Promise<AssetCategory[]> {
  const categories: AssetCategory[] = [];

  for (const cat of ASSET_CATEGORIES) {
    const count = await prisma.asset.count({
      where: {
        asset_type: cat.id,
        status: 'published',
      },
    });

    categories.push({
      ...cat,
      asset_count: count,
    });
  }

  return categories;
}
