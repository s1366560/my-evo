import { NextRequest, NextResponse } from 'next/server';

const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

function getAuthHeaders(request: NextRequest): Record<string, string> {
  const authHeader = request.headers.get('authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }
  return headers;
}

// POST /api/frontend/maps - Save a map
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodes, edges, config, name, description, isPublic } = body;

    if (!nodes) {
      return NextResponse.json({ error: 'Map nodes are required' }, { status: 400 });
    }

    // Get auth token from cookies or header
    const token = request.cookies.get('token')?.value || 
                  request.headers.get('x-token') ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${backendUrl}/map/save`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        nodes,
        edges,
        config,
        name: name || 'Untitled Map',
        description,
        isPublic,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Failed to save map' }, { status: res.status });
    }

    return NextResponse.json({ success: true, message: data.message, map_id: data.map_id });
  } catch (error) {
    console.error('Save map error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/frontend/maps - Get user's saved maps
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value || 
                  request.headers.get('x-token') ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const res = await fetch(`${backendUrl}/api/map/saved`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Failed to get maps' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Get maps error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
