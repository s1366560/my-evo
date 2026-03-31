/**
 * Community Evolution Engine
 * Guild management and novelty scoring
 */

import { randomBytes } from 'crypto';
import { Guild, GuildMember, Circle, NoveltyScore } from './types';

// In-memory stores
const guilds = new Map<string, Guild>();
const guildMembers = new Map<string, GuildMember[]>(); // guild_id -> members
const circles = new Map<string, Circle>();
const noveltyScores = new Map<string, NoveltyScore>();

/** Generate a short ID */
function genId(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString('hex')}`;
}

/** List all guilds */
export function listGuilds(): Guild[] {
  return Array.from(guilds.values()).filter(g => g.status === 'active');
}

/** Get guild by ID */
export function getGuild(guildId: string): Guild | undefined {
  return guilds.get(guildId);
}

/** Create a new guild */
export function createGuild(name: string, description: string, creatorId: string): Guild {
  const guildId = genId('guild');
  const guild: Guild = {
    guild_id: guildId,
    name,
    description,
    creator_id: creatorId,
    created_at: new Date().toISOString(),
    member_count: 1,
    total_genes: 0,
    total_capsules: 0,
    novelty_score: 0,
    status: 'active',
  };
  guilds.set(guildId, guild);
  
  // Add creator as first member
  const members: GuildMember[] = [{
    node_id: creatorId,
    joined_at: guild.created_at,
    contribution_score: 0,
    genes_published: 0,
    capsules_published: 0,
  }];
  guildMembers.set(guildId, members);
  
  return guild;
}

/** Get guild members */
export function getGuildMembers(guildId: string): GuildMember[] {
  return guildMembers.get(guildId) || [];
}

/** Join a guild */
export function joinGuild(guildId: string, nodeId: string): { success: boolean; message: string } {
  const guild = guilds.get(guildId);
  if (!guild) {
    return { success: false, message: 'Guild not found' };
  }
  
  if (guild.status !== 'active') {
    return { success: false, message: 'Guild is not active' };
  }
  
  const members = guildMembers.get(guildId) || [];
  
  // Check if already a member
  if (members.some(m => m.node_id === nodeId)) {
    return { success: false, message: 'Already a member of this guild' };
  }
  
  const newMember: GuildMember = {
    node_id: nodeId,
    joined_at: new Date().toISOString(),
    contribution_score: 0,
    genes_published: 0,
    capsules_published: 0,
  };
  
  members.push(newMember);
  guildMembers.set(guildId, members);
  guild.member_count = members.length;
  guilds.set(guildId, guild);
  
  return { success: true, message: 'Successfully joined guild' };
}

/** Leave a guild */
export function leaveGuild(guildId: string, nodeId: string): { success: boolean; message: string } {
  const guild = guilds.get(guildId);
  if (!guild) {
    return { success: false, message: 'Guild not found' };
  }
  
  const members = guildMembers.get(guildId) || [];
  const memberIndex = members.findIndex(m => m.node_id === nodeId);
  
  if (memberIndex === -1) {
    return { success: false, message: 'Not a member of this guild' };
  }
  
  // Cannot leave if you're the creator
  if (guild.creator_id === nodeId) {
    return { success: false, message: 'Guild creator cannot leave. Transfer ownership or disband the guild.' };
  }
  
  members.splice(memberIndex, 1);
  guildMembers.set(guildId, members);
  guild.member_count = members.length;
  guilds.set(guildId, guild);
  
  return { success: true, message: 'Successfully left guild' };
}

/** List all circles */
export function listCircles(): Circle[] {
  return Array.from(circles.values()).filter(c => c.status === 'active');
}

/** Get circle by ID */
export function getCircle(circleId: string): Circle | undefined {
  return circles.get(circleId);
}

/** Get novelty score for a node */
export function getNoveltyScore(nodeId: string): NoveltyScore | undefined {
  return noveltyScores.get(nodeId);
}

/** Calculate and update novelty score for a node */
export function updateNoveltyScore(nodeId: string): NoveltyScore {
  // Get or create novelty score
  let score = noveltyScores.get(nodeId);
  if (!score) {
    score = {
      node_id: nodeId,
      novelty_score: Math.random() * 100, // Placeholder calculation
      genes_contributed: 0,
      capsules_contributed: 0,
      evaluation_period: new Date().toISOString().slice(0, 10),
      rank: 0,
    };
  }
  
  // In a real implementation, this would calculate based on:
  // - How novel the node's contributions are compared to others
  // - Rarity of signals/categories used
  // - Performance metrics
  
  score.evaluation_period = new Date().toISOString().slice(0, 10);
  noveltyScores.set(nodeId, score);
  
  return score;
}

/** Initialize with sample data */
function initSampleData() {
  // Sample guild
  const sampleGuild: Guild = {
    guild_id: 'guild_sample',
    name: 'Innovation Guild',
    description: 'A community focused on innovative AI solutions',
    creator_id: 'node_pioneer',
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    member_count: 5,
    total_genes: 23,
    total_capsules: 12,
    novelty_score: 87.5,
    status: 'active',
  };
  guilds.set(sampleGuild.guild_id, sampleGuild);
  
  // Sample circle
  const sampleCircle: Circle = {
    circle_id: 'circle_sample',
    name: 'Q2 Innovation Circle',
    description: 'Quarterly innovation challenge',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    status: 'active',
    participant_count: 8,
    rounds_completed: 2,
    outcomes: ['Improved latency by 20%', 'New caching strategy'],
  };
  circles.set(sampleCircle.circle_id, sampleCircle);
  
  // Sample novelty scores
  const sampleNodes = ['node_alpha', 'node_beta', 'node_gamma'];
  sampleNodes.forEach((nodeId, idx) => {
    noveltyScores.set(nodeId, {
      node_id: nodeId,
      novelty_score: 90 - idx * 10,
      genes_contributed: 15 - idx * 3,
      capsules_contributed: 8 - idx * 2,
      evaluation_period: new Date().toISOString().slice(0, 10),
      rank: idx + 1,
    });
  });
}

// Initialize sample data
initSampleData();
