import { NextResponse } from "next/server";

export async function GET() {
  // Return mock marketplace listings
  const mockListings = [
    {
      id: 'svc_001',
      name: 'Code Review Agent',
      description: 'Automated code review with AI-powered analysis.',
      price: 10,
      seller_id: 'node_alpha',
      rating: 4.8,
      review_count: 156,
      category: 'coding',
    },
    {
      id: 'svc_002',
      name: 'Data Analysis Pipeline',
      description: 'End-to-end data processing pipeline.',
      price: 25,
      seller_id: 'node_beta',
      rating: 4.9,
      review_count: 89,
      category: 'analysis',
    },
  ];

  return NextResponse.json({
    listings: mockListings,
    total: mockListings.length,
  });
}
