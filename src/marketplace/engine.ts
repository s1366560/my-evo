// Service Marketplace Engine - Core business logic

import { v4 as uuidv4 } from 'uuid';
import {
  ServiceListing,
  ServiceOrder,
  ServiceSearchQuery,
  ServiceStatus,
  OrderStatus,
  PublishServiceRequest,
  OrderServiceRequest,
  RateServiceRequest
} from './types.js';

export class MarketplaceEngine {
  private listings: Map<string, ServiceListing> = new Map();
  private orders: Map<string, ServiceOrder> = new Map();
  private readonly PLATFORM_FEE_RATE = 0.30; // 30% platform fee

  /**
   * Publish a new service listing
   */
  publishService(providerId: string, req: PublishServiceRequest): ServiceListing {
    const now = new Date().toISOString();
    const listing: ServiceListing = {
      id: `svc_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
      provider_id: providerId,
      title: req.title,
      description: req.description || '',
      capabilities: req.capabilities,
      price_per_task: req.price_per_task,
      max_concurrent: req.max_concurrent,
      active_orders: 0,
      completed_orders: 0,
      total_revenue: 0,
      rating_sum: 0,
      rating_count: 0,
      status: ServiceStatus.ACTIVE,
      created_at: now,
      updated_at: now
    };
    this.listings.set(listing.id, listing);
    return listing;
  }

  /**
   * Update a service listing
   */
  updateService(listingId: string, providerId: string, updates: Partial<PublishServiceRequest>): ServiceListing | null {
    const listing = this.listings.get(listingId);
    if (!listing || listing.provider_id !== providerId) {
      return null;
    }
    const now = new Date().toISOString();
    Object.assign(listing, {
      ...updates,
      updated_at: now
    });
    this.listings.set(listingId, listing);
    return listing;
  }

  /**
   * Get a service listing by ID
   */
  getListing(listingId: string): ServiceListing | null {
    return this.listings.get(listingId) || null;
  }

  /**
   * Search service listings
   */
  searchServices(query: ServiceSearchQuery): ServiceListing[] {
    let results = Array.from(this.listings.values())
      .filter(l => l.status === ServiceStatus.ACTIVE);

    // Text search on title and capabilities
    if (query.q) {
      const q = query.q.toLowerCase();
      results = results.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.capabilities.some(c => c.toLowerCase().includes(q))
      );
    }

    // Filter by capability
    if (query.capability) {
      results = results.filter(l =>
        l.capabilities.includes(query.capability!)
      );
    }

    // Price range filter
    if (query.min_price !== undefined) {
      results = results.filter(l => l.price_per_task >= query.min_price!);
    }
    if (query.max_price !== undefined) {
      results = results.filter(l => l.price_per_task <= query.max_price!);
    }

    // Sort
    const sortBy = query.sort_by || 'created_at';
    const sortOrder = query.sort_order || 'desc';
    results.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'price':
          cmp = a.price_per_task - b.price_per_task;
          break;
        case 'rating':
          cmp = (a.rating_count > 0 ? a.rating_sum / a.rating_count : 0) -
                (b.rating_count > 0 ? b.rating_sum / b.rating_count : 0);
          break;
        case 'revenue':
          cmp = a.total_revenue - b.total_revenue;
          break;
        case 'created_at':
        default:
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    // Pagination
    const offset = query.offset || 0;
    const limit = query.limit || 20;
    return results.slice(offset, offset + limit);
  }

  /**
   * List all active service listings (paginated)
   */
  listServices(limit = 20, offset = 0): ServiceListing[] {
    return Array.from(this.listings.values())
      .filter(l => l.status === ServiceStatus.ACTIVE)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(offset, offset + limit);
  }

  /**
   * Get orders for a specific user (as provider or buyer)
   */
  getUserOrders(userId: string): ServiceOrder[] {
    return Array.from(this.orders.values())
      .filter(o => o.provider_id === userId || o.buyer_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): ServiceOrder | null {
    return this.orders.get(orderId) || null;
  }

  /**
   * Place an order for a service
   */
  placeOrder(buyerId: string, req: OrderServiceRequest): ServiceOrder | { error: string } {
    const listing = this.listings.get(req.listing_id);
    if (!listing) {
      return { error: 'listing_not_found' };
    }
    if (listing.status !== ServiceStatus.ACTIVE) {
      return { error: 'listing_not_active' };
    }
    if (listing.active_orders >= listing.max_concurrent) {
      return { error: 'service_at_capacity' };
    }
    if (req.amount !== listing.price_per_task) {
      return { error: 'amount_mismatch' };
    }

    const now = new Date().toISOString();
    const platform_fee = Math.floor(req.amount * this.PLATFORM_FEE_RATE);
    const provider_earnings = req.amount - platform_fee;

    const order: ServiceOrder = {
      id: `ord_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
      listing_id: req.listing_id,
      buyer_id: buyerId,
      provider_id: listing.provider_id,
      question: req.question,
      amount: req.amount,
      platform_fee,
      provider_earnings,
      status: OrderStatus.IN_PROGRESS,
      created_at: now,
      updated_at: now
    };

    // Update listing active orders
    listing.active_orders++;
    this.listings.set(listing.id, listing);
    this.orders.set(order.id, order);

    return order;
  }

  /**
   * Complete an order (provider submits answer)
   */
  completeOrder(orderId: string, providerId: string, answer: string): ServiceOrder | { error: string } {
    const order = this.orders.get(orderId);
    if (!order) {
      return { error: 'order_not_found' };
    }
    if (order.provider_id !== providerId) {
      return { error: 'not_authorised' };
    }
    if (order.status !== OrderStatus.IN_PROGRESS) {
      return { error: 'order_not_in_progress' };
    }

    const now = new Date().toISOString();
    order.answer = answer;
    order.status = OrderStatus.COMPLETED;
    order.updated_at = now;
    order.completed_at = now;

    // Update listing stats
    const listing = this.listings.get(order.listing_id);
    if (listing) {
      listing.active_orders = Math.max(0, listing.active_orders - 1);
      listing.completed_orders++;
      listing.total_revenue += order.provider_earnings;
      this.listings.set(listing.id, listing);
    }

    this.orders.set(order.id, order);
    return order;
  }

  /**
   * Rate a completed order
   */
  rateOrder(orderId: string, userId: string, rating: number, comment?: string): ServiceOrder | { error: string } {
    const order = this.orders.get(orderId);
    if (!order) {
      return { error: 'order_not_found' };
    }
    if (order.buyer_id !== userId) {
      return { error: 'not_authorised' };
    }
    if (order.status !== OrderStatus.COMPLETED) {
      return { error: 'order_not_completed' };
    }
    if (order.rating !== undefined) {
      return { error: 'already_rated' };
    }
    if (rating < 1 || rating > 5) {
      return { error: 'invalid_rating' };
    }

    const now = new Date().toISOString();
    order.rating = rating;
    order.comment = comment;
    order.updated_at = now;

    // Update listing rating
    const listing = this.listings.get(order.listing_id);
    if (listing) {
      listing.rating_sum += rating;
      listing.rating_count++;
      this.listings.set(listing.id, listing);
    }

    this.orders.set(order.id, order);
    return order;
  }

  /**
   * Cancel an order (buyer can cancel if not completed)
   */
  cancelOrder(orderId: string, userId: string): { success: boolean; error?: string } {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, error: 'order_not_found' };
    }
    if (order.buyer_id !== userId && order.provider_id !== userId) {
      return { success: false, error: 'not_authorised' };
    }
    if (order.status === OrderStatus.COMPLETED) {
      return { success: false, error: 'cannot_cancel_completed' };
    }
    if (order.status === OrderStatus.CANCELLED) {
      return { success: false, error: 'already_cancelled' };
    }

    const now = new Date().toISOString();
    order.status = OrderStatus.CANCELLED;
    order.updated_at = now;

    // Update listing active orders
    const listing = this.listings.get(order.listing_id);
    if (listing) {
      listing.active_orders = Math.max(0, listing.active_orders - 1);
      this.listings.set(listing.id, listing);
    }

    this.orders.set(order.id, order);
    return { success: true };
  }

  /**
   * Expire stale orders (orders in progress for too long)
   */
  expireOrders(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): string[] {
    const now = Date.now();
    const expired: string[] = [];
    for (const order of this.orders.values()) {
      if (order.status === OrderStatus.IN_PROGRESS) {
        const age = now - new Date(order.created_at).getTime();
        if (age > maxAgeMs) {
          order.status = OrderStatus.EXPIRED;
          order.updated_at = new Date().toISOString();
          this.orders.set(order.id, order);

          // Update listing active orders
          const listing = this.listings.get(order.listing_id);
          if (listing) {
            listing.active_orders = Math.max(0, listing.active_orders - 1);
            this.listings.set(listing.id, listing);
          }
          expired.push(order.id);
        }
      }
    }
    return expired;
  }

  /**
   * Get marketplace statistics
   */
  getStats(): {
    total_listings: number;
    total_orders: number;
    total_volume: number;
    avg_rating: number;
  } {
    const listings = Array.from(this.listings.values()).filter(l => l.status === ServiceStatus.ACTIVE);
    const orders = Array.from(this.orders.values());
    const totalRating = listings.reduce((sum, l) => sum + l.rating_sum, 0);
    const totalRatingCount = listings.reduce((sum, l) => sum + l.rating_count, 0);

    return {
      total_listings: listings.length,
      total_orders: orders.length,
      total_volume: orders.reduce((sum, o) => sum + o.amount, 0),
      avg_rating: totalRatingCount > 0 ? totalRating / totalRatingCount : 0
    };
  }
}

export default MarketplaceEngine;
