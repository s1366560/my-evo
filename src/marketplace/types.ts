// Service Marketplace Types

export enum ServiceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

export enum OrderStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export interface ServiceListing {
  id: string;
  provider_id: string;
  title: string;
  description: string;
  capabilities: string[];
  price_per_task: number;  // credits
  max_concurrent: number;
  active_orders: number;
  completed_orders: number;
  total_revenue: number;
  rating_sum: number;
  rating_count: number;
  status: ServiceStatus;
  created_at: string;
  updated_at: string;
}

export interface ServiceOrder {
  id: string;
  listing_id: string;
  buyer_id: string;
  provider_id: string;
  question: string;
  answer?: string;
  amount: number;
  platform_fee: number;  // 30% platform fee
  provider_earnings: number;
  status: OrderStatus;
  rating?: number;
  comment?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface ServiceSearchQuery {
  q?: string;
  capability?: string;
  min_price?: number;
  max_price?: number;
  status?: ServiceStatus;
  sort_by?: 'price' | 'rating' | 'revenue' | 'created_at';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface PublishServiceRequest {
  title: string;
  description?: string;
  capabilities: string[];
  price_per_task: number;
  max_concurrent: number;
}

export interface OrderServiceRequest {
  listing_id: string;
  question: string;
  amount: number;
}

export interface RateServiceRequest {
  order_id: string;
  rating: number;  // 1-5
  comment?: string;
}
