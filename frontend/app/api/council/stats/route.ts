import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/council/stats`);
    if (!res.ok) throw new Error("Failed to fetch council stats");
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ proposals: [] }, { status: 200 });
  }
}
