/**
 * API Route: GET/POST /api/v2/maps
 * Proxies to Backend: GET/POST /api/v1/map
 * Fixes path mismatch: backend uses /api/v1/map (singular), frontend was using /maps (plural)
 */
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const qs = searchParams.toString();
  const url = `${BACKEND}/api/v1/map${qs ? `?${qs}` : ""}`;
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

export async function POST(request: NextRequest) {
  const body = await request.json();
  const url = `${BACKEND}/api/v1/map`;
  try {
    const res = await fetch(url, {
      method: "POST",
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
