/**
 * Community Evolution Engine
 * Guild management and novelty scoring
 */

import { randomBytes } from 'crypto';
import { Guild, GuildMember, Circle, NoveltyScore } from './types';
import type { Gene, Capsule } from '../assets/types';

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

/**
 * Calculate the novelty score for a node.
 * Novelty measures how unique/rares a node's contributions are compared to the network.
 * 
 * Formula: novelty_score = signal_diversity * (1 - category_concentration) * signal_rarity
 * 
 * - signal_diversity: how varied the signals are (Shannon entropy-like measure, 0-1)
 * - category_concentration: how concentrated in one category (0-1, lower=better)
 * - signal_rarity: how rare the signals are in the overall network (0-1)
 */
export function updateNoveltyScore(nodeId: string): NoveltyScore {
  // Gather all published assets from this node
  const { listAssets } = require('../assets/store');

  const nodeAssetRecords = listAssets({ ownerId: nodeId, limit: 1000 })
    .filter(r => r.status === 'promoted' || r.status === 'active');
  
  const genes = nodeAssetRecords
    .filter(r => r.asset.type === 'Gene')
    .map(r => r.asset as Gene);
  const capsules = nodeAssetRecords
    .filter(r => r.asset.type === 'Capsule')
    .map(r => r.asset as Capsule);
  
  const genesContributed = genes.length;
  const capsulesContributed = capsules.length;
  
  if (genesContributed === 0 && capsulesContributed === 0) {
    const score: NoveltyScore = {
      node_id: nodeId,
      novelty_score: 0,
      genes_contributed: 0,
      capsules_contributed: 0,
      evaluation_period: new Date().toISOString().slice(0, 10),
      rank: 0,
    };
    noveltyScores.set(nodeId, score);
    return score;
  }
  
  // 1. Signal diversity: measure entropy across all signals used by this node
  const allSignals: string[] = [];
  const categoryCounts = new Map<string, number>();
  
  for (const gene of genes) {
    allSignals.push(...gene.signals_match);
    const cat = gene.category || 'uncategorized';
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }
  for (const capsule of capsules) {
    const triggers = Array.isArray(capsule.trigger) ? capsule.trigger : [capsule.trigger];
    allSignals.push(...triggers.filter(Boolean));
  }
  
  // Shannon-entropy-like diversity: H = -sum(p_i * log(p_i))
  const signalFreq = new Map<string, number>();
  for (const sig of allSignals) {
    signalFreq.set(sig, (signalFreq.get(sig) || 0) + 1);
  }
  
  let entropy = 0;
  if (allSignals.length > 0) {
    for (const count of signalFreq.values()) {
      const p = count / allSignals.length;
      entropy -= p * Math.log2(p);
    }
  }
  // Normalize: max entropy for n signals is log2(n), so diversity = entropy / max_entropy
  const maxEntropy = Math.log2(Math.max(signalFreq.size, 1));
  const signalDiversity = maxEntropy > 0 ? entropy / maxEntropy : 0;
  
  // 2. Category concentration: what fraction of genes are in the dominant category
  let maxCatCount = 0;
  let totalCatCount = 0;
  for (const [cat, count] of categoryCounts) {
    maxCatCount = Math.max(maxCatCount, count);
    totalCatCount += count;
  }
  const categoryConcentration = totalCatCount > 0 ? maxCatCount / totalCatCount : 0;
  
  // 3. Signal rarity: how uncommon are this node's signals vs the global network
  // Gather all promoted assets globally to compute global signal frequencies
  const allAssetRecords = listAssets({ status: 'promoted', limit: 10000 })
    .filter(r => r.owner_id !== nodeId); // exclude self for fair comparison
  
  const globalSignalCounts = new Map<string, number>();
  for (const record of allAssetRecords) {
    if (record.asset.type === 'Gene') {
      const gene = record.asset as Gene;
      for (const sig of gene.signals_match) {
        globalSignalCounts.set(sig, (globalSignalCounts.get(sig) || 0) + 1);
      }
    } else if (record.asset.type === 'Capsule') {
      const capsule = record.asset as Capsule;
      const triggers = Array.isArray(capsule.trigger) ? capsule.trigger : [capsule.trigger];
      for (const sig of triggers.filter(Boolean)) {
        globalSignalCounts.set(sig, (globalSignalCounts.get(sig) || 0) + 1);
      }
    }
  }
  
  let rarityScore = 0;
  const uniqueSignals = Array.from(signalFreq.keys());
  if (uniqueSignals.length > 0 && globalSignalCounts.size > 0) {
    // Average inverse frequency: signals that appear less in the network score higher
    let raritySum = 0;
    for (const sig of uniqueSignals) {
      const globalCount = globalSignalCounts.get(sig) || 0;
      // Rarity: 1 if never seen globally, decreasing as more agents use it
      const rarity = 1 / (1 + Math.log1p(globalCount));
      raritySum += rarity;
    }
    rarityScore = raritySum / uniqueSignals.length;
  } else if (uniqueSignals.length > 0) {
    // No global data yet = all signals are novel by default
    rarityScore = 1.0;
  }
  
  // Combined novelty score
  // Diverse signals + low category concentration + rare signals = high novelty
  const noveltyScore = Math.min(100, Math.round(
    signalDiversity * (1 - categoryConcentration) * signalRarityScore(rarityScore) * 100
  ));
  
  // Also factor in volume (some novelty for contributing a lot)
  const contributionBonus = Math.min(10, Math.log1p(genesContributed + capsulesContributed) * 2);
  const finalScore = Math.min(100, noveltyScore + contributionBonus);
  
  const score: NoveltyScore = {
    node_id: nodeId,
    novelty_score: finalScore,
    genes_contributed: genesContributed,
    capsules_contributed: capsulesContributed,
    evaluation_period: new Date().toISOString().slice(0, 10),
    rank: 0,
  };
  
  noveltyScores.set(nodeId, score);
  return score;
}

function signalRarityScore(rarity: number): number {
  // Maps 0-1 to a multiplier that rewards rarity
  return 0.3 + rarity * 0.7;
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
