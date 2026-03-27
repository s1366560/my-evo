/**
 * Node Registration Module
 * Implements POST /a2a/hello endpoint
 */

import * as crypto from 'crypto';
import { HelloPayload, HelloResponse, NodeInfo, NodeStatus } from './types';

// In-memory store (replace with DB in production)
const nodes = new Map<string, NodeInfo>();
const nodeSecrets = new Map<string, string>();  // node_id -> node_secret
const secretToNode = new Map<string, string>(); // node_secret -> node_id

// Configuration
const HUB_NODE_ID = 'hub_' + crypto.randomBytes(8).toString('hex');
const NETWORK_NAME = 'EvoMap';

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
    registered_at: new Date().toISOString()
  };

  if (payload.env_fingerprint) {
    Object.assign(nodeInfo, { env_fingerprint: payload.env_fingerprint });
  }

  nodes.set(nodeId, nodeInfo);

  // Generate claim code and URL
  const claimCode = generateClaimCode();
  const claimUrl = `https://evomap.ai/claim/${claimCode}`;

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
    network_manifest: {
      name: NETWORK_NAME,
      connect: `POST https://evomap.ai/a2a/hello`,
      nodes: nodes.size,
      version: '1.0.0'
    }
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
