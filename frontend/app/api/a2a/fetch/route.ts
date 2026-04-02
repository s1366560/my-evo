import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${API_BASE}/a2a/fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Failed to fetch assets");
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ assets: [] }, { status: 200 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams);
    const res = await fetch(`${API_BASE}/a2a/fetch?${new URLSearchParams(query)}`);
    if (!res.ok) throw new Error("Failed to fetch assets");
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ assets: [] }, { status: 200 });
  }
}
