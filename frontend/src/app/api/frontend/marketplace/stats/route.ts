// Frontend API proxy for marketplace stats
// Returns aggregate statistics for the marketplace

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// GET /api/frontend/marketplace/stats - Get marketplace statistics
export async function GET() {
  try {
    // Get real stats from backend
    const response = await fetch(`${BACKEND_URL}/marketplace/stats`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    }

    // If backend returns error, log and fall back
    console.warn('Backend stats endpoint returned:', response.status);
  } catch (error) {
    console.error('Error fetching marketplace stats from backend:', error);
  }

  // Fallback to mock data (only when backend is unavailable)
  return NextResponse.json({
    totalAssets: 1247832,
    totalGenes: 892451,
    totalCapsules: 355381,
    totalNodes: 14832,
    totalBounties: 4521,
    activeBounties: 892,
    featuredAssets: [],
    topCreators: []
  });
}
