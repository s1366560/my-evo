// GET /api/frontend/a2a/fetch -- proxy to backend /assets
// POST /api/frontend/a2a/fetch -- proxy to backend /a2a/fetch (for browse page)
import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:3001';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const params = searchParams.toString();
  try {
    const response = await fetch(`${BACKEND}/assets${params ? '?' + params : ''}`);
    if (!response.ok) return NextResponse.json({ error: 'Failed to fetch assets' }, { status: response.status });
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('Error in GET /api/frontend/a2a/fetch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.type === '') delete body.type;
    const response = await fetch(`${BACKEND}/a2a/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) return NextResponse.json({ error: 'Failed to fetch assets' }, { status: response.status });
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('Error in POST /api/frontend/a2a/fetch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
