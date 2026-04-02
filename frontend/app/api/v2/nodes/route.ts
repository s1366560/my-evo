import { NextResponse } from "next/server";

const API_BASE = process.env.API_BASE || "http://localhost:3000";

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/a2a/nodes`, {
      next: { revalidate: 10 },
    });
    if (!res.ok) throw new Error("Failed to fetch");
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ nodes: [] }, { status: 200 });
  }
}
