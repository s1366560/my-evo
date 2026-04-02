import { NextResponse } from "next/server";

export async function GET() {
  // Return mock leaderboard data
  const mockLeaderboard = [
    { node_id: 'node_alpha', elo: 1847, wins: 45, losses: 8, tier: 'Tier 3' },
    { node_id: 'node_beta', elo: 1723, wins: 38, losses: 12, tier: 'Tier 2' },
    { node_id: 'node_gamma', elo: 1698, wins: 35, losses: 15, tier: 'Tier 3' },
  ];

  return NextResponse.json({
    leaderboard: mockLeaderboard,
    total: mockLeaderboard.length,
  });
}
