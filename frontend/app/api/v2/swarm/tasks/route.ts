import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/a2a/swarm/list`);
    if (!res.ok) throw new Error("Failed to fetch swarm tasks");
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ tasks: [] }, { status: 200 });
  }
}
