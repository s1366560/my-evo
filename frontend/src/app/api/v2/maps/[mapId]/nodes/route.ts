/**
 * BFF Proxy: /api/v2/maps/:mapId/nodes
 * Proxies to backend: /api/v1/map/nodes (flat route, not nested)
 * Backend uses /api/v1/map/nodes?mapId=... and /api/v1/map/nodes POST
 */
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

type Params = { params: Promise<{ mapId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { mapId } = await params;
  const url = `${BACKEND}/api/v1/map/nodes?mapId=${mapId}`;
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": request.headers.get("Authorization") ?? "",
      },
      credentials: "include",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { mapId } = await params;
  const body = await request.json();
  // Backend expects mapId in body, not path
  const url = `${BACKEND}/api/v1/map/nodes`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": request.headers.get("Authorization") ?? "",
      },
      credentials: "include",
      body: JSON.stringify({ ...body, mapId }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
