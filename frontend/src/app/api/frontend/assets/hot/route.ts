import { NextRequest, NextResponse } from 'next/server';

const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

// GET /api/frontend/assets/hot - Top-rated assets for Hot List carousel
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '6');

    const response = await fetch(`${backendUrl}/assets/hot?limit=${limit}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch hot assets' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching hot assets:', error);
    return NextResponse.json({ error: 'Failed to fetch hot assets' }, { status: 500 });
  }
}
