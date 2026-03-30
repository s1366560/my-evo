/**
 * Asset Reviews Service - CRUD for Gene/Capsule reviews
 * Based on evomap.ai skill-protocol.md REST endpoints
 */

import { randomUUID } from 'crypto';
import type { Review, ReviewSummary, ReviewVote } from './types';

// In-memory review store: asset_id -> reviews
const reviewStore: Map<string, Review[]> = new Map();
// Summary cache: asset_id -> summary
const summaryCache: Map<string, ReviewSummary> = new Map();

function invalidateCache(assetId: string): void {
  summaryCache.delete(assetId);
}

function computeSummary(assetId: string, reviews: Review[]): ReviewSummary {
  if (reviews.length === 0) {
    return {
      asset_id: assetId,
      avg_rating: 0,
      total_reviews: 0,
      up_votes: 0,
      down_votes: 0,
      rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) {
    dist[r.rating] = (dist[r.rating] || 0) + 1;
  }
  return {
    asset_id: assetId,
    avg_rating: Math.round((sum / reviews.length) * 100) / 100,
    total_reviews: reviews.length,
    up_votes: reviews.filter(r => r.vote === 'up').length,
    down_votes: reviews.filter(r => r.vote === 'down').length,
    rating_distribution: dist,
  };
}

function notFound(msg: string): Error {
  return Object.assign(new Error(msg), { status: 404 });
}
function badRequest(msg: string): Error {
  return Object.assign(new Error(msg), { status: 400 });
}
function conflict(msg: string): Error {
  return Object.assign(new Error(msg), { status: 409 });
}
function forbidden(msg: string): Error {
  return Object.assign(new Error(msg), { status: 403 });
}

/**
 * List all reviews for an asset
 */
export function listReviews(assetId: string): Review[] {
  return reviewStore.get(assetId) ?? [];
}

/**
 * Get a single review by ID
 */
export function getReview(assetId: string, reviewId: string): Review | undefined {
  const reviews = reviewStore.get(assetId);
  return reviews?.find(r => r.id === reviewId);
}

/**
 * Get review summary for an asset
 */
export function getReviewSummary(assetId: string): ReviewSummary {
  if (summaryCache.has(assetId)) {
    return summaryCache.get(assetId)!;
  }
  const reviews = reviewStore.get(assetId) ?? [];
  const summary = computeSummary(assetId, reviews);
  summaryCache.set(assetId, summary);
  return summary;
}

/**
 * Create a new review for an asset
 * One review per reviewer per asset
 */
export function createReview(params: {
  assetId: string;
  reviewerId: string;
  rating: number;
  title?: string;
  body?: string;
  vote: ReviewVote;
  use_case?: string;
}): Review {
  const { assetId, reviewerId, rating, title, body, vote, use_case } = params;

  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw badRequest('Rating must be integer 1-5');
  }
  if (!['up', 'down'].includes(vote)) {
    throw badRequest('Vote must be "up" or "down"');
  }

  const existing = reviewStore.get(assetId)?.find(r => r.reviewer_id === reviewerId);
  if (existing) {
    throw conflict('Reviewer already reviewed this asset');
  }

  const now = new Date().toISOString();
  const review: Review = {
    id: `rev_${randomUUID()}`,
    asset_id: assetId,
    reviewer_id: reviewerId,
    rating,
    title,
    body,
    vote,
    use_case,
    created_at: now,
  };

  const existingReviews = reviewStore.get(assetId) ?? [];
  reviewStore.set(assetId, [...existingReviews, review]);
  invalidateCache(assetId);
  return review;
}

/**
 * Update an existing review
 */
export function updateReview(params: {
  assetId: string;
  reviewId: string;
  reviewerId: string;
  rating?: number;
  title?: string;
  body?: string;
  vote?: ReviewVote;
  use_case?: string;
}): Review {
  const { assetId, reviewId, reviewerId, rating, title, body, vote, use_case } = params;

  const reviews = reviewStore.get(assetId);
  if (!reviews) throw notFound('Asset not found');

  const idx = reviews.findIndex(r => r.id === reviewId);
  if (idx === -1) throw notFound('Review not found');

  const review = reviews[idx];
  if (review.reviewer_id !== reviewerId) {
    throw forbidden('Not authorized to update this review');
  }

  if (rating !== undefined && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
    throw badRequest('Rating must be integer 1-5');
  }
  if (vote !== undefined && !['up', 'down'].includes(vote)) {
    throw badRequest('Vote must be "up" or "down"');
  }

  const updated: Review = {
    ...review,
    rating: rating ?? review.rating,
    title: title ?? review.title,
    body: body ?? review.body,
    vote: vote ?? review.vote,
    use_case: use_case ?? review.use_case,
    updated_at: new Date().toISOString(),
  };

  reviews[idx] = updated;
  reviewStore.set(assetId, reviews);
  invalidateCache(assetId);
  return updated;
}

/**
 * Delete a review
 */
export function deleteReview(params: {
  assetId: string;
  reviewId: string;
  reviewerId: string;
}): void {
  const { assetId, reviewId, reviewerId } = params;

  const reviews = reviewStore.get(assetId);
  if (!reviews) throw notFound('Asset not found');

  const review = reviews.find(r => r.id === reviewId);
  if (!review) throw notFound('Review not found');
  if (review.reviewer_id !== reviewerId) {
    throw forbidden('Not authorized to delete this review');
  }

  reviewStore.set(assetId, reviews.filter(r => r.id !== reviewId));
  invalidateCache(assetId);
}
