// Frontend API proxy for user's assets
// Routes to backend /api/assets/my

import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function GET(request: NextRequest) {
  try {
    // Get auth token from cookie
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const response = await fetch(`${API_BASE}/assets/my`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch user assets' }));
      return NextResponse.json({ error: error.message || 'Failed to fetch user assets' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching user assets:', error);
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 503 });
  }
}
