import { NextRequest, NextResponse } from 'next/server';

const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

// GET /api/frontend/assets - List assets
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const type = searchParams.get('type');
    const sort = searchParams.get('sort') || 'recent';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query params for backend
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (type) params.set('type', type);
    params.set('sort', sort);
    params.set('limit', limit.toString());
    params.set('offset', offset.toString());

    const response = await fetch(`${backendUrl}/assets?${params}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch assets' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }
}

// POST /api/frontend/assets - Create/publish asset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, name, description, content, tags, license } = body;

    // Get auth token from cookies or header
    const token = request.cookies.get('token')?.value || 
                  request.headers.get('x-token') ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Call backend API
    const response = await fetch(`${backendUrl}/assets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type, name, description, content, tags, license }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const asset = await response.json();
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error('Error publishing asset:', error);
    return NextResponse.json({ error: 'Failed to publish asset' }, { status: 500 });
  }
}
