// Service Marketplace Tests - Comprehensive test suite for service marketplace

import { describe, test, expect, beforeEach } from 'vitest';
import { MarketplaceEngine } from '../src/marketplace/engine.js';
import { ServiceStatus, OrderStatus } from '../src/marketplace/types.js';

describe('MarketplaceEngine', () => {
  let engine: MarketplaceEngine;

  beforeEach(() => {
    engine = new MarketplaceEngine();
  });

  describe('publishService', () => {
    test('publishes a new service listing', () => {
      const listing = engine.publishService('node-1', {
        title: 'Code Review Service',
        description: 'Professional code review',
        capabilities: ['code-review', 'security'],
        price_per_task: 50,
        max_concurrent: 3
      });

      expect(listing.id).toMatch(/^svc_/);
      expect(listing.provider_id).toBe('node-1');
      expect(listing.title).toBe('Code Review Service');
      expect(listing.price_per_task).toBe(50);
      expect(listing.status).toBe(ServiceStatus.ACTIVE);
      expect(listing.active_orders).toBe(0);
      expect(listing.completed_orders).toBe(0);
    });

    test('generates unique IDs for each listing', () => {
      const listing1 = engine.publishService('node-1', {
        title: 'Service 1', capabilities: ['test'], price_per_task: 10, max_concurrent: 1
      });
      const listing2 = engine.publishService('node-1', {
        title: 'Service 2', capabilities: ['test'], price_per_task: 20, max_concurrent: 2
      });

      expect(listing1.id).not.toBe(listing2.id);
    });
  });

  describe('searchServices', () => {
    beforeEach(() => {
      engine.publishService('node-1', {
        title: 'Code Review', description: 'Professional review',
        capabilities: ['code-review'], price_per_task: 50, max_concurrent: 3
      });
      engine.publishService('node-2', {
        title: 'Security Audit', description: 'Security analysis',
        capabilities: ['security', 'code-review'], price_per_task: 100, max_concurrent: 2
      });
      engine.publishService('node-3', {
        title: 'Data Analysis', description: 'Analytics service',
        capabilities: ['analytics'], price_per_task: 75, max_concurrent: 5
      });
    });

    test('searches by text query in title', () => {
      const results = engine.searchServices({ q: 'code review' });
      expect(results.length).toBe(2); // Code Review + Security Audit (has code-review capability)
    });

    test('searches by capability', () => {
      const results = engine.searchServices({ capability: 'security' });
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Security Audit');
    });

    test('filters by price range', () => {
      const results = engine.searchServices({ min_price: 60, max_price: 90 });
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Data Analysis');
    });

    test('sorts by price ascending', () => {
      const results = engine.searchServices({ sort_by: 'price', sort_order: 'asc' });
      expect(results[0].price_per_task).toBe(50);
      expect(results[1].price_per_task).toBe(75);
      expect(results[2].price_per_task).toBe(100);
    });

    test('paginates results', () => {
      const page1 = engine.searchServices({ limit: 2, offset: 0 });
      const page2 = engine.searchServices({ limit: 2, offset: 2 });
      expect(page1.length).toBe(2);
      expect(page2.length).toBe(1);
    });
  });

  describe('placeOrder', () => {
    test('creates an order successfully', () => {
      const listing = engine.publishService('provider-1', {
        title: 'Test Service', capabilities: ['test'], price_per_task: 50, max_concurrent: 3
      });

      const order = engine.placeOrder('buyer-1', {
        listing_id: listing.id,
        question: 'Can you review my code?',
        amount: 50
      });

      expect(order).not.toHaveProperty('error');
      expect((order as any).id).toMatch(/^ord_/);
      expect((order as any).listing_id).toBe(listing.id);
      expect((order as any).buyer_id).toBe('buyer-1');
      expect((order as any).provider_id).toBe('provider-1');
      expect((order as any).amount).toBe(50);
      expect((order as any).platform_fee).toBe(15); // 30% of 50
      expect((order as any).provider_earnings).toBe(35);
      expect((order as any).status).toBe(OrderStatus.IN_PROGRESS);
    });

    test('rejects order with wrong amount', () => {
      const listing = engine.publishService('provider-1', {
        title: 'Test Service', capabilities: ['test'], price_per_task: 50, max_concurrent: 3
      });

      const result = engine.placeOrder('buyer-1', {
        listing_id: listing.id,
        question: 'Test',
        amount: 40 // Wrong amount
      });

      expect(result).toHaveProperty('error', 'amount_mismatch');
    });

    test('rejects order for non-existent listing', () => {
      const result = engine.placeOrder('buyer-1', {
        listing_id: 'non_existent',
        question: 'Test',
        amount: 50
      });

      expect(result).toHaveProperty('error', 'listing_not_found');
    });

    test('rejects order when service at max capacity', () => {
      const listing = engine.publishService('provider-1', {
        title: 'Test Service', capabilities: ['test'], price_per_task: 50, max_concurrent: 1
      });

      engine.placeOrder('buyer-1', {
        listing_id: listing.id,
        question: 'Order 1',
        amount: 50
      });

      const result = engine.placeOrder('buyer-2', {
        listing_id: listing.id,
        question: 'Order 2',
        amount: 50
      });

      expect(result).toHaveProperty('error', 'service_at_capacity');
    });
  });

  describe('completeOrder', () => {
    test('completes order and updates listing stats', () => {
      const listing = engine.publishService('provider-1', {
        title: 'Test Service', capabilities: ['test'], price_per_task: 100, max_concurrent: 3
      });

      const order = engine.placeOrder('buyer-1', {
        listing_id: listing.id,
        question: 'Please help',
        amount: 100
      }) as any;

      expect(listing.active_orders).toBe(1);

      const completed = engine.completeOrder(order.id, 'provider-1', 'Here is the answer');

      expect(completed).not.toHaveProperty('error');
      expect((completed as any).status).toBe(OrderStatus.COMPLETED);
      expect((completed as any).answer).toBe('Here is the answer');

      const updatedListing = engine.getListing(listing.id);
      expect(updatedListing!.active_orders).toBe(0);
      expect(updatedListing!.completed_orders).toBe(1);
      expect(updatedListing!.total_revenue).toBe(70); // 100 - 30% platform fee
    });

    test('rejects completion by non-provider', () => {
      const listing = engine.publishService('provider-1', {
        title: 'Test Service', capabilities: ['test'], price_per_task: 50, max_concurrent: 3
      });

      const order = engine.placeOrder('buyer-1', {
        listing_id: listing.id,
        question: 'Test',
        amount: 50
      }) as any;

      const result = engine.completeOrder(order.id, 'wrong-person', 'answer');
      expect(result).toHaveProperty('error', 'not_authorised');
    });
  });

  describe('rateOrder', () => {
    test('allows buyer to rate completed order', () => {
      const listing = engine.publishService('provider-1', {
        title: 'Test Service', capabilities: ['test'], price_per_task: 50, max_concurrent: 3
      });

      const order = engine.placeOrder('buyer-1', {
        listing_id: listing.id,
        question: 'Test',
        amount: 50
      }) as any;

      engine.completeOrder(order.id, 'provider-1', 'Great work!');

      const rated = engine.rateOrder(order.id, 'buyer-1', 5, 'Excellent service!');

      expect(rated).not.toHaveProperty('error');
      expect((rated as any).rating).toBe(5);
      expect((rated as any).comment).toBe('Excellent service!');

      const updatedListing = engine.getListing(listing.id);
      expect(updatedListing!.rating_sum).toBe(5);
      expect(updatedListing!.rating_count).toBe(1);
    });

    test('rejects rating by non-buyer', () => {
      const listing = engine.publishService('provider-1', {
        title: 'Test Service', capabilities: ['test'], price_per_task: 50, max_concurrent: 3
      });

      const order = engine.placeOrder('buyer-1', {
        listing_id: listing.id,
        question: 'Test',
        amount: 50
      }) as any;

      engine.completeOrder(order.id, 'provider-1', 'Done');

      const result = engine.rateOrder(order.id, 'stranger', 5);
      expect(result).toHaveProperty('error', 'not_authorised');
    });

    test('rejects invalid rating', () => {
      const listing = engine.publishService('provider-1', {
        title: 'Test Service', capabilities: ['test'], price_per_task: 50, max_concurrent: 3
      });

      const order = engine.placeOrder('buyer-1', {
        listing_id: listing.id,
        question: 'Test',
        amount: 50
      }) as any;

      engine.completeOrder(order.id, 'provider-1', 'Done');

      const result = engine.rateOrder(order.id, 'buyer-1', 6);
      expect(result).toHaveProperty('error', 'invalid_rating');
    });

    test('rejects duplicate rating', () => {
      const listing = engine.publishService('provider-1', {
        title: 'Test Service', capabilities: ['test'], price_per_task: 50, max_concurrent: 3
      });

      const order = engine.placeOrder('buyer-1', {
        listing_id: listing.id,
        question: 'Test',
        amount: 50
      }) as any;

      engine.completeOrder(order.id, 'provider-1', 'Done');
      engine.rateOrder(order.id, 'buyer-1', 5);

      const result = engine.rateOrder(order.id, 'buyer-1', 4);
      expect(result).toHaveProperty('error', 'already_rated');
    });
  });

  describe('cancelOrder', () => {
    test('allows buyer to cancel in-progress order', () => {
      const listing = engine.publishService('provider-1', {
        title: 'Test Service', capabilities: ['test'], price_per_task: 50, max_concurrent: 3
      });

      const order = engine.placeOrder('buyer-1', {
        listing_id: listing.id,
        question: 'Test',
        amount: 50
      }) as any;

      expect(listing.active_orders).toBe(1);

      const result = engine.cancelOrder(order.id, 'buyer-1');

      expect(result.success).toBe(true);

      const updatedListing = engine.getListing(listing.id);
      expect(updatedListing!.active_orders).toBe(0);
    });

    test('rejects cancellation of completed order', () => {
      const listing = engine.publishService('provider-1', {
        title: 'Test Service', capabilities: ['test'], price_per_task: 50, max_concurrent: 3
      });

      const order = engine.placeOrder('buyer-1', {
        listing_id: listing.id,
        question: 'Test',
        amount: 50
      }) as any;

      engine.completeOrder(order.id, 'provider-1', 'Done');

      const result = engine.cancelOrder(order.id, 'buyer-1');
      expect(result).toHaveProperty('error', 'cannot_cancel_completed');
    });
  });

  describe('getStats', () => {
    test('returns correct marketplace statistics', () => {
      const listing1 = engine.publishService('provider-1', {
        title: 'Service 1', capabilities: ['test'], price_per_task: 50, max_concurrent: 3
      });
      const listing2 = engine.publishService('provider-2', {
        title: 'Service 2', capabilities: ['test'], price_per_task: 100, max_concurrent: 2
      });

      const order1 = engine.placeOrder('buyer-1', {
        listing_id: listing1.id, question: 'Q1', amount: 50
      }) as any;
      engine.completeOrder(order1.id, 'provider-1', 'A1');
      engine.rateOrder(order1.id, 'buyer-1', 4);

      engine.placeOrder('buyer-2', {
        listing_id: listing2.id, question: 'Q2', amount: 100
      });

      const stats = engine.getStats();

      expect(stats.total_listings).toBe(2);
      expect(stats.total_orders).toBe(2);
      expect(stats.total_volume).toBe(150);
      expect(stats.avg_rating).toBe(4);
    });
  });
});
