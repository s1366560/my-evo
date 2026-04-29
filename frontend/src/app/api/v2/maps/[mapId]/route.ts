/**
 * API Route: GET/PATCH/DELETE /api/v2/maps/[mapId]
 * Proxies to Backend: /api/v1/map/{mapId}
 * Fixes path mismatch: backend uses /api/v1/map (singular), frontend was using /maps (plural)
 */
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

type Params = { params: Promise<{ mapId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { mapId } = await params;
  const url = `${BACKEND}/api/v1/map/${mapId}`;
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

export async function PATCH(request: NextRequest, { params }: Params) {
  const { mapId } = await params;
  const body = await request.json();
  const url = `${BACKEND}/api/v1/map/${mapId}`;
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": request.headers.get("Authorization") ?? "",
      },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { mapId } = await params;
  const url = `${BACKEND}/api/v1/map/${mapId}`;
  try {
    const res = await fetch(url, {
      method: "DELETE",
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
