// Service Marketplace API - A2A protocol wrapper

import { MarketplaceEngine } from './engine.js';
import { ServiceStatus } from './types.js';

export class MarketplaceAPI {
  constructor(private engine: MarketplaceEngine) {}

  /**
   * Publish a new service
   * POST /a2a/service/publish
   */
  publishService(providerId: string, req: {
    title: string;
    description?: string;
    capabilities: string[];
    price_per_task: number;
    max_concurrent: number;
  }): any {
    if (!req.title || !req.capabilities || req.price_per_task === undefined || req.max_concurrent === undefined) {
      return { error: 'missing_fields', message: 'title, capabilities, price_per_task, max_concurrent required' };
    }
    if (req.price_per_task < 1) {
      return { error: 'invalid_price', message: 'price_per_task must be >= 1' };
    }
    if (req.max_concurrent < 1 || req.max_concurrent > 100) {
      return { error: 'invalid_concurrent', message: 'max_concurrent must be 1-100' };
    }

    const listing = this.engine.publishService(providerId, req);
    return {
      protocol: 'gep-a2a',
      message_type: 'service_published',
      payload: { listing }
    };
  }

  /**
   * Update a service listing
   * POST /a2a/service/:id/update
   */
  updateService(listingId: string, providerId: string, req: {
    title?: string;
    description?: string;
    capabilities?: string[];
    price_per_task?: number;
    max_concurrent?: number;
  }): any {
    const listing = this.engine.updateService(listingId, providerId, req);
    if (!listing) {
      return { error: 'not_found', message: 'Listing not found or not authorised' };
    }
    return {
      protocol: 'gep-a2a',
      message_type: 'service_updated',
      payload: { listing }
    };
  }

  /**
   * Get service details
   * GET /a2a/service/:id
   */
  getService(listingId: string): any {
    const listing = this.engine.getListing(listingId);
    if (!listing) {
      return { error: 'not_found', message: 'Service listing not found' };
    }
    return {
      protocol: 'gep-a2a',
      payload: { listing }
    };
  }

  /**
   * Search services
   * GET /a2a/service/search?q=xxx&capability=xxx&min_price=xx&max_price=xx
   */
  searchServices(query: {
    q?: string;
    capability?: string;
    min_price?: number;
    max_price?: number;
    sort_by?: 'price' | 'rating' | 'revenue' | 'created_at';
    sort_order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): any {
    const results = this.engine.searchServices({
      q: query.q,
      capability: query.capability,
      min_price: query.min_price,
      max_price: query.max_price,
      sort_by: query.sort_by,
      sort_order: query.sort_order,
      limit: query.limit || 20,
      offset: query.offset || 0
    });

    return {
      protocol: 'gep-a2a',
      message_type: 'search_results',
      payload: {
        listings: results,
        count: results.length
      }
    };
  }

  /**
   * List all services
   * GET /a2a/service/list
   */
  listServices(query: { limit?: number; offset?: number } = {}): any {
    const listings = this.engine.listServices(query.limit || 20, query.offset || 0);
    const stats = this.engine.getStats();
    return {
      protocol: 'gep-a2a',
      payload: {
        listings,
        stats
      }
    };
  }

  /**
   * Place an order for a service
   * POST /a2a/service/order
   */
  placeOrder(buyerId: string, req: {
    listing_id: string;
    question: string;
    amount: number;
  }): any {
    if (!req.listing_id || !req.question || req.amount === undefined) {
      return { error: 'missing_fields', message: 'listing_id, question, amount required' };
    }

    const result = this.engine.placeOrder(buyerId, {
      listing_id: req.listing_id,
      question: req.question,
      amount: req.amount
    });

    if ('error' in result) {
      return { error: result.error, message: result.error };
    }

    return {
      protocol: 'gep-a2a',
      message_type: 'order_placed',
      payload: { order: result }
    };
  }

  /**
   * Complete an order (deliver answer)
   * POST /a2a/service/order/:id/complete
   */
  completeOrder(orderId: string, providerId: string, req: { answer: string }): any {
    if (!req.answer) {
      return { error: 'missing_fields', message: 'answer required' };
    }

    const result = this.engine.completeOrder(orderId, providerId, req.answer);
    if ('error' in result) {
      return { error: result.error, message: result.error };
    }

    return {
      protocol: 'gep-a2a',
      message_type: 'order_completed',
      payload: { order: result }
    };
  }

  /**
   * Get order details
   * GET /a2a/service/order/:id
   */
  getOrder(orderId: string): any {
    const order = this.engine.getOrder(orderId);
    if (!order) {
      return { error: 'not_found', message: 'Order not found' };
    }
    return {
      protocol: 'gep-a2a',
      payload: { order }
    };
  }

  /**
   * Get user's orders
   * GET /a2a/service/orders?user_id=xxx
   */
  getUserOrders(userId: string): any {
    const orders = this.engine.getUserOrders(userId);
    return {
      protocol: 'gep-a2a',
      payload: { orders }
    };
  }

  /**
   * Rate a completed order
   * POST /a2a/service/rate
   */
  rateOrder(orderId: string, userId: string, req: { rating: number; comment?: string }): any {
    if (!req.rating || req.rating < 1 || req.rating > 5) {
      return { error: 'invalid_rating', message: 'rating must be 1-5' };
    }

    const result = this.engine.rateOrder(orderId, userId, req.rating, req.comment);
    if ('error' in result) {
      return { error: result.error, message: result.error };
    }

    return {
      protocol: 'gep-a2a',
      message_type: 'order_rated',
      payload: { order: result }
    };
  }

  /**
   * Cancel an order
   * POST /a2a/service/order/:id/cancel
   */
  cancelOrder(orderId: string, userId: string): any {
    const result = this.engine.cancelOrder(orderId, userId);
    if (!result.success) {
      return { error: result.error, message: result.error };
    }

    return {
      protocol: 'gep-a2a',
      message_type: 'order_cancelled',
      payload: { order_id: orderId }
    };
  }

  /**
   * Get marketplace stats
   * GET /a2a/service/stats
   */
  getStats(): any {
    return {
      protocol: 'gep-a2a',
      payload: this.engine.getStats()
    };
  }
}

export default MarketplaceAPI;
