import { PrismaClient } from '@prisma/client';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

// ----- Drift zone -----

export interface DriftZone {
  bottleId: string;
  zoneX: number; // -1 to 1, horizontal
  zoneY: number; // -1 to 1, vertical
  zoneLabel: string; // e.g., "NE" (northeast)
}

// Assigns a zone label based on x/y coordinates
function labelZone(x: number, y: number): string {
  const horizontal = x >= 0 ? 'E' : 'W';
  const vertical = y >= 0 ? 'N' : 'S';
  if (Math.abs(x) < 0.33 && Math.abs(y) < 0.33) {
    return 'C'; // center
  }
  return `${vertical}${horizontal}`;
}

/**
 * Derive a stable zone for a bottle based on its ID and age.
 * Deterministic so the same bottle always lands in the same zone.
 */
export function getDriftZone(bottleId: string): DriftZone {
  // Use bottleId as a deterministic seed for pseudo-random zone assignment
  const hash = [...bottleId].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const normalizedHash = (hash % 1000) / 1000; // 0-1
  const ageHash = normalizedHash * 0.2; // zone shifts slightly over time

  const zoneX = (normalizedHash * 2 - 1 + ageHash * 0.5) * 0.9; // clamp roughly to [-1, 1]
  const zoneY = (Math.sin(hash * 0.1) * 0.8 + ageHash * 0.3);

  return {
    bottleId,
    zoneX: Math.max(-1, Math.min(1, zoneX)),
    zoneY: Math.max(-1, Math.min(1, zoneY)),
    zoneLabel: labelZone(zoneX, zoneY),
  };
}

// ----- Drift direction -----

export interface DriftDirection {
  dx: number; // horizontal velocity component
  dy: number; // vertical velocity component
  dominant: 'N' | 'S' | 'E' | 'W' | 'calm';
}

export interface DriftConditions {
  wind?: { x: number; y: number }; // normalized -1 to 1
  current?: { x: number; y: number }; // normalized -1 to 1
}

/**
 * Calculate drift direction from wind and ocean current vectors.
 * Both inputs are normalized in [-1, 1].
 */
export function calculateDriftDirection(
  wind: { x: number; y: number },
  current: { x: number; y: number },
): DriftDirection {
  // Wind has 60% influence, current has 40%
  const dx = wind.x * 0.6 + current.x * 0.4;
  const dy = wind.y * 0.6 + current.y * 0.4;

  const threshold = 0.1;
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
    return { dx, dy, dominant: 'calm' };
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    return { dx, dy, dominant: dx >= 0 ? 'E' : 'W' };
  }
  return { dx, dy, dominant: dy >= 0 ? 'N' : 'S' };
}

// ----- Drift simulation -----

export interface DriftStep {
  timestamp: string;
  zoneX: number;
  zoneY: number;
  zoneLabel: string;
}

export interface DriftSimulationResult {
  bottleId: string;
  steps: DriftStep[];
  totalDistance: number;
  dominantDirection: DriftDirection['dominant'];
}

/**
 * Simulate the drift path of a bottle over time.
 * Returns a series of positions with timestamps.
 */
export async function simulateDrift(
  bottleId: string,
): Promise<DriftSimulationResult | null> {
  const record = await prisma.driftBottle.findUnique({
    where: { bottle_id: bottleId },
  });

  if (!record) {
    return null;
  }

  // Use deterministic conditions seeded from bottleId
  const seed = [...bottleId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const wind: { x: number; y: number } = {
    x: Math.sin(seed * 0.7) * 0.8,
    y: Math.cos(seed * 0.3) * 0.6,
  };
  const current: { x: number; y: number } = {
    x: Math.cos(seed * 0.5) * 0.4,
    y: Math.sin(seed * 0.9) * 0.3,
  };

  const direction = calculateDriftDirection(wind, current);

  // Simulate 4 steps: 0h, 24h, 48h, 72h
  const steps: DriftStep[] = [];
  let x = 0;
  let y = 0;
  const hours = [0, 24, 48, 72];

  for (const h of hours) {
    x += direction.dx * h * 0.01;
    y += direction.dy * h * 0.01;
    const zone = getDriftZone(`${bottleId}-${h}`);
    steps.push({
      timestamp: new Date(
        (record.thrown_at as Date).getTime() + h * 60 * 60 * 1000,
      ).toISOString(),
      zoneX: x,
      zoneY: y,
      zoneLabel: zone.zoneLabel,
    });
  }

  const totalDistance = Math.sqrt(x * x + y * y);

  return {
    bottleId,
    steps,
    totalDistance,
    dominantDirection: direction.dominant,
  };
}

// ----- Discovery rate effect -----

export interface DiscoveryRateEffect {
  bottleId: string;
  zoneLabel: string;
  rateMultiplier: number; // >1 means more discoverable, <1 means less
  reason: string;
}

/**
 * Affect the discovery rate of a bottle based on its drift zone.
 * Popular zones (center) have lower rates due to competition;
 * remote zones have higher rates as an incentive.
 */
export async function affectDiscoveryRate(
  bottleId: string,
): Promise<DiscoveryRateEffect | null> {
  const record = await prisma.driftBottle.findUnique({
    where: { bottle_id: bottleId },
  });

  if (!record) {
    return null;
  }

  const zone = getDriftZone(bottleId);

  // Distance from center: 0 = center, sqrt(2) = corner
  const distFromCenter = Math.sqrt(zone.zoneX ** 2 + zone.zoneY ** 2);
  // Map [0, 1.4] to [0.7, 1.5]: center is slightly crowded, edges are scarce
  const rateMultiplier = 0.7 + (distFromCenter / Math.SQRT2) * 0.8;

  let reason: string;
  if (zone.zoneLabel === 'C') {
    reason = 'Bottle in high-traffic central zone — many finders competing';
  } else {
    reason = `Bottle in ${zone.zoneLabel} zone — remote zone boosts visibility`;
  }

  return {
    bottleId,
    zoneLabel: zone.zoneLabel,
    rateMultiplier,
    reason,
  };
}
