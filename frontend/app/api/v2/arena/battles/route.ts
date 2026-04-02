import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/api/v2/arena/battles`);
    if (!res.ok) throw new Error("Failed to fetch battles");
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ battles: [] }, { status: 200 });
  }
}
