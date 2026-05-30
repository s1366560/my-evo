import { NextResponse } from "next/server";

// Fallback stats — used when the backend /a2a/stats endpoint is unavailable.
// The NavBar, StatsGrid, and HeroSection all query this route.
export const dynamic = "force-dynamic";

const FALLBACK_STATS = {
  alive_nodes: 1923,
  total_nodes: 2847,
  total_genes: 14832,
  total_capsules: 3204,
  total_recipes: 891,
  active_swarms: 147,
};

export async function GET() {
  return NextResponse.json({ success: true, data: FALLBACK_STATS });
}
