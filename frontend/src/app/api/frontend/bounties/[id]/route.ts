// Frontend API proxy for individual bounty operations
// Routes to backend /api/bounty/*

import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { action, deliverable } = body;

    let endpoint = '';
    let requestBody = {};

    switch (action) {
      case 'claim':
        endpoint = `${API_BASE}/bounty/claim`;
        requestBody = { bountyId: id };
        break;
      case 'submit':
        endpoint = `${API_BASE}/bounty/submit`;
        requestBody = { bountyId: id, deliverable };
        break;
      case 'review':
        endpoint = `${API_BASE}/bounty/review`;
        requestBody = { bountyId: id, claimId: body.claimId, action: body.reviewAction };
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Operation failed' }));
      return NextResponse.json({ error: error.message || 'Operation failed' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error processing bounty action:', error);
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 503 });
  }
}
