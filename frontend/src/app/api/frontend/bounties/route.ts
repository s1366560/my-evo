// Frontend API proxy for bounties
// Routes to backend /api/bounty/*

import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// GET /api/frontend/bounties - List all bounties
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (type) params.set('type', type);

    const response = await fetch(`${API_BASE}/bounty/list?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch bounties' }));
      return NextResponse.json({ error: error.message || 'Failed to fetch bounties' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching bounties:', error);
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 503 });
  }
}

// POST /api/frontend/bounties - Create a new bounty
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const response = await fetch(`${API_BASE}/bounty/create`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to create bounty' }));
      return NextResponse.json({ error: error.message || 'Failed to create bounty' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating bounty:', error);
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 503 });
  }
}
