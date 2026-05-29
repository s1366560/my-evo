/**
 * BFF Proxy: GET /api/v2/dashboard/*
 * Proxies to backend /api/v2/dashboard/*
 */
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.pathname.replace("/api/v2", "");
  const url = `${BACKEND}/api/v2${path}`;
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
