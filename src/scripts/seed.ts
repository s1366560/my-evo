/**
 * EvoMap Hub - Database Seeder
 *
 * Seeds the database with initial data for development and testing.
 * Run with: npx ts-node src/scripts/seed.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seed...');

  // Create demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@evomap.ai' },
    update: {},
    create: {
      email: 'demo@evomap.ai',
      password_hash: '$2a$10$demohashnotreal', // Placeholder - use proper bcrypt in production
      trust_level: 'verified',
    },
  });
  console.log(`[Seed] Created user: ${user.email} (id: ${user.id})`);

  // Create demo map
  const map = await prisma.map.upsert({
    where: { map_id: 'map_demo_001' },
    update: {},
    create: {
      map_id: 'map_demo_001',
      name: 'Demo Evolution Map',
      description: 'A demo evolutionary map showing concept relationships',
      map_type: 'evolution',
      layout_type: 'force',
      owner_id: user.id,
      is_public: true,
      node_count: 0,
      edge_count: 0,
    },
  });
  console.log(`[Seed] Created map: ${map.name} (id: ${map.map_id})`);

  // Create demo nodes
  const nodes = [
    { id: 'node_001', node_id: 'node_concept_1', label: 'Machine Learning', description: 'Core ML concepts', node_type: 'domain', x: 0, y: 0 },
    { id: 'node_002', node_id: 'node_concept_2', label: 'Deep Learning', description: 'Neural network approaches', node_type: 'domain', x: 1, y: 1 },
    { id: 'node_003', node_id: 'node_concept_3', label: 'NLP', description: 'Natural language processing', node_type: 'domain', x: -1, y: 1 },
    { id: 'node_004', node_id: 'node_concept_4', label: 'Computer Vision', description: 'Visual recognition systems', node_type: 'domain', x: 1, y: -1 },
  ];

  for (const nodeData of nodes) {
    await prisma.mapNode.upsert({
      where: { map_id_node_id: { map_id: map.map_id, node_id: nodeData.node_id } },
      update: {},
      create: { ...nodeData, map_id: map.map_id, status: 'active', size: 1 },
    });
  }
  console.log(`[Seed] Created ${nodes.length} demo nodes`);

  // Create demo edges
  const edges = [
    { id: 'edge_001', edge_id: 'edge_1', source_node_id: 'node_001', target_node_id: 'node_002', edge_type: 'derives', label: 'evolves to' },
    { id: 'edge_002', edge_id: 'edge_2', source_node_id: 'node_001', target_node_id: 'node_003', edge_type: 'derives', label: 'enables' },
    { id: 'edge_003', edge_id: 'edge_3', source_node_id: 'node_001', target_node_id: 'node_004', edge_type: 'derives', label: 'enables' },
  ];

  for (const edgeData of edges) {
    await prisma.mapEdge.upsert({
      where: { map_id_edge_id: { map_id: map.map_id, edge_id: edgeData.edge_id } },
      update: {},
      create: { ...edgeData, map_id: map.map_id, weight: 1 },
    });
  }
  console.log(`[Seed] Created ${edges.length} demo edges`);

  // Update map counts
  await prisma.map.update({
    where: { map_id: map.map_id },
    data: { node_count: nodes.length, edge_count: edges.length },
  });

  console.log('[Seed] Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('[Seed] Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
