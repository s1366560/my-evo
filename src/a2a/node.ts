/**
 * Node Registration Module
 * Implements POST /a2a/hello endpoint
 */

import * as crypto from 'crypto';
import { HelloPayload, HelloResponse, NodeInfo, NodeStatus, StarterGeneEntry } from './types';
import { initializeCreditBalance } from '../reputation/engine';
import { listAssets, getAssetContent } from '../assets/store';
import { Gene } from '../assets/types';

// In-memory store (replace with DB in production)
const nodes = new Map<string, NodeInfo>();
const nodeSecrets = new Map<string, string>();  // node_id -> node_secret
const secretToNode = new Map<string, string>(); // node_secret -> node_id

// Configuration
const HUB_NODE_ID = 'hub_' + crypto.randomBytes(8).toString('hex');
const NETWORK_NAME = 'EvoMap';

// Starter Gene Pack settings
const STARTER_GENE_MIN_GDI = 40;  // Minimum GDI for starter genes
const STARTER_GENES_PER_CATEGORY = 3;  // Max genes per category
const STARTER_GENE_CATEGORIES = ['repair', 'optimize', 'innovate', 'govern'] as const;

/**
 * Get Starter Gene Pack for new agents
 * Selects high-quality promoted genes with GDI >= 40, max 3 per category
 * Genes are distributed to authors as rewards when included in starter packs
 */
async function getStarterGenePack(): Promise<StarterGeneEntry[]> {
  const starterGenes: StarterGeneEntry[] = [];
  const addedGeneIds = new Set<string>();

  for (const category of STARTER_GENE_CATEGORIES) {
    // Get promoted genes in this category with high GDI
    const genes = listAssets({
      type: 'Gene',
      status: 'promoted',
      limit: 50,
    });

    // Sort by GDI total (descending) and filter by category and GDI threshold
    const qualifiedGenes = genes
      .filter(record => {
        const asset = record.asset as Gene;
        return (
          asset.type === 'Gene' &&
          asset.category === category &&
          record.gdi &&
          record.gdi.total >= STARTER_GENE_MIN_GDI &&
          !addedGeneIds.has(record.asset.asset_id)
        );
      })
      .sort((a, b) => (b.gdi?.total ?? 0) - (a.gdi?.total ?? 0))
      .slice(0, STARTER_GENES_PER_CATEGORY);

    for (const record of qualifiedGenes) {
      const gene = record.asset as Gene;
      addedGeneIds.add(gene.asset_id);
      starterGenes.push({
        asset_id: gene.asset_id,
        id: gene.id,
        category: gene.category,
        summary: gene.strategy.slice(0, 2).join('; '),  // First 2 strategy steps as summary
        signals_match: gene.signals_match,
        strategy: gene.strategy,
        author_id: record.owner_id,
      });
    }
  }

  return starterGenes;
}

/**
 * Generate a new node ID
 */
function generateNodeId(): string {
  return 'node_' + crypto.randomBytes(12).toString('hex');
}

/**
 * Generate a 64-character hex node secret
 */
function generateNodeSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate claim code for node claiming
 */
function generateClaimCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[crypto.randomInt(chars.length)];
  }
  return code;
}

/**
 * Register a new node or return existing node info
 */
export async function registerNode(
  payload: HelloPayload,
  existingNodeId?: string
): Promise<HelloResponse> {
  let nodeId: string;
  let nodeSecret: string;
  let isNewNode = false;

  // Check if node already exists (for heartbeat/rotate scenarios)
  if (existingNodeId && nodes.has(existingNodeId)) {
    const existingNode = nodes.get(existingNodeId)!;
    
    // Handle secret rotation
    if (payload.rotate_secret) {
      // Remove old secret mappings
      const oldSecret = nodeSecrets.get(existingNodeId);
      if (oldSecret) {
        secretToNode.delete(oldSecret);
      }
      
      nodeId = existingNodeId;
      nodeSecret = generateNodeSecret();
      isNewNode = false;
    } else {
      // Return existing node info
      const existingSecret = nodeSecrets.get(existingNodeId)!;
      return {
        status: 'acknowledged',
        your_node_id: existingNodeId,
        hub_node_id: HUB_NODE_ID,
        node_secret: existingSecret,
        credit_balance: 0,  // Would fetch from DB
        survival_status: 'alive' as const,
        referral_code: existingNodeId,
        recommended_tasks: [],
        hello_rate_limit: 60,         // 60 requests per hour
        heartbeat_interval_ms: 300000, // 5 minutes
        network_manifest: {
          name: NETWORK_NAME,
          connect: `POST https://evomap.ai/a2a/hello`
        }
      };
    }
  } else {
    // New node registration
    nodeId = generateNodeId();
    nodeSecret = generateNodeSecret();
    isNewNode = true;
  }

  // Store secret mappings
  nodeSecrets.set(nodeId, nodeSecret);
  secretToNode.set(nodeSecret, nodeId);

  // Create node info
  const nodeInfo: NodeInfo = {
    node_id: nodeId,
    status: 'alive',
    model: payload.model,
    reputation: 0,
    gene_count: payload.gene_count ?? 0,
    capsule_count: payload.capsule_count ?? 0,
    last_heartbeat: new Date().toISOString(),
    registered_at: new Date().toISOString(),
    identity_doc: payload.identity_doc,
    constitution: payload.constitution,
    referrer: payload.referrer,
  };

  if (payload.env_fingerprint) {
    Object.assign(nodeInfo, { env_fingerprint: payload.env_fingerprint });
  }

  // Process referral bonus if referrer is provided
  if (isNewNode && payload.referrer) {
    try {
      const { creditForReferral } = await import('../reputation/engine');
      creditForReferral(payload.referrer, nodeId);
    } catch (e) {
      // Referrer processing is best-effort; don't fail registration
    }
  }

  nodes.set(nodeId, nodeInfo);

  // Initialize credit balance for new nodes
  if (isNewNode) {
    initializeCreditBalance(nodeId);
  }

  // Generate claim code and URL
  const claimCode = generateClaimCode();
  const claimUrl = `https://evomap.ai/claim/${claimCode}`;

  // Get starter gene pack for new nodes (high-quality genes to help them get started)
  const starterGenePack = isNewNode ? await getStarterGenePack() : undefined;

  return {
    status: 'acknowledged',
    your_node_id: nodeId,
    hub_node_id: HUB_NODE_ID,
    node_secret: nodeSecret,
    claim_code: claimCode,
    claim_url: claimUrl,
    credit_balance: isNewNode ? 500 : 0,  // Initial endowment for new nodes
    survival_status: 'alive',
    referral_code: nodeId,
    recommended_tasks: [],
    hello_rate_limit: 60,         // 60 requests per hour
    heartbeat_interval_ms: 300000, // 5 minutes
    network_manifest: {
      name: NETWORK_NAME,
      connect: `POST https://evomap.ai/a2a/hello`,
      nodes: nodes.size,
      version: '1.0.0'
    },
    starter_gene_pack: starterGenePack,
  };
}

/**
 * Validate node secret and return node_id
 */
export function validateNodeSecret(secret: string): string | null {
  return secretToNode.get(secret) || null;
}

/**
 * Get node info by node_id
 */
export function getNodeInfo(nodeId: string): NodeInfo | null {
  return nodes.get(nodeId) || null;
}

/**
 * Update node heartbeat timestamp
 */
export function updateHeartbeat(nodeId: string): boolean {
  const node = nodes.get(nodeId);
  if (!node) return false;
  
  node.last_heartbeat = new Date().toISOString();
  node.status = 'alive';
  return true;
}

/**
 * Check if node is considered offline (no heartbeat for 45 minutes)
 */
export function isNodeOffline(nodeId: string): boolean {
  const node = nodes.get(nodeId);
  if (!node || !node.last_heartbeat) return true;
  
  const lastHeartbeat = new Date(node.last_heartbeat);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastHeartbeat.getTime()) / 1000 / 60;
  
  return diffMinutes >= 45;
}

/**
 * Mark node as offline
 */
export function markNodeOffline(nodeId: string): boolean {
  const node = nodes.get(nodeId);
  if (!node) return false;
  
  node.status = 'offline';
  return true;
}

/**
 * Mark node as in quarantine
 */
export function markNodeQuarantine(nodeId: string): boolean {
  const node = nodes.get(nodeId);
  if (!node) return false;
  
  node.status = 'quarantine';
  return true;
}

/**
 * Get all nodes
 */
export function getAllNodes(): NodeInfo[] {
  return Array.from(nodes.values());
}

/**
 * Get online nodes (alive status with recent heartbeat)
 */
export function getOnlineNodes(): NodeInfo[] {
  return Array.from(nodes.values()).filter(node => {
    if (node.status !== 'alive') return false;
    return !isNodeOffline(node.node_id);
  });
}

export { HUB_NODE_ID };

/**
 * Get node activity (recent operations)
 */
export function getNodeActivity(nodeId: string): {
  node: NodeInfo | null;
  recent_assets: string[];
  published_count: number;
  fetched_count: number;
  last_seen: string | null;
} {
  const node = nodes.get(nodeId) ?? null;
  if (!node) return { node: null, recent_assets: [], published_count: 0, fetched_count: 0, last_seen: null };

  return {
    node,
    recent_assets: [],
    published_count: node.gene_count + node.capsule_count,
    fetched_count: 0,
    last_seen: node.last_heartbeat ?? null,
  };
}

/**
 * Reset all in-memory stores - FOR TESTING ONLY
 */
export function resetStores(): void {
  nodes.clear();
  nodeSecrets.clear();
  secretToNode.clear();
}
