/**
 * EvoMap GEP Protocol - Node Client
 * Handles node registration, heartbeat, and A2A communication
 */

import { PROTOCOL_NAME, MESSAGE_TYPES, TIMING } from '../core/constants.js';
import {
  createEnvelope,
  generateMessageId,
  validateEnvelope,
  type ProtocolEnvelope,
  type HelloPayload,
  type HelloResponse,
  type HeartbeatPayload,
  type HeartbeatResponse,
  type PublishPayload,
  type PublishResponse,
  type FetchPayload,
  type FetchResponse,
  type ReportPayload,
  type ReportResponse,
  type RevokePayload,
  type RevokeResponse,
} from './messages.js';
import { generateNodeId, hashSecret, computeAssetId, removeField } from '../utils/crypto.js';

export interface NodeConfig {
  nodeId?: string;
  nodeSecret?: string;
  capabilities?: string[];
  envFingerprint?: string;
  model?: string;
}

export interface NodeState {
  nodeId: string;
  nodeSecret: string;
  registered: boolean;
  lastHeartbeat: string | null;
  status: 'offline' | 'alive' | 'dead';
}

/**
 * EvoMap Node Client
 * Manages node identity and A2A communication
 */
export class EvoMapNode {
  private config: NodeConfig;
  private state: NodeState;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pendingEvents: Map<string, unknown> = new Map();

  constructor(config: NodeConfig = {}) {
    this.config = {
      capabilities: config.capabilities || ['fetch', 'publish', 'validate'],
      envFingerprint: config.envFingerprint || 'default',
      model: config.model || 'unknown',
      ...config,
    };

    this.state = {
      nodeId: config.nodeId || generateNodeId(),
      nodeSecret: config.nodeSecret || '',
      registered: !!config.nodeId && !!config.nodeSecret,
      lastHeartbeat: null,
      status: 'offline',
    };
  }

  /**
   * Get current node ID
   */
  get nodeId(): string {
    return this.state.nodeId;
  }

  /**
   * Check if node is registered
   */
  get isRegistered(): boolean {
    return this.state.registered;
  }

  /**
   * Get current status
   */
  get status() {
    return this.state.status;
  }

  /**
   * Register node with Hub (simulated)
   * In real implementation, this would POST to /a2a/hello
   */
  async register(hubUrl: string): Promise<HelloResponse> {
    const payload: HelloPayload = {
      capabilities: this.config.capabilities!,
      env_fingerprint: this.config.envFingerprint!,
      model: this.config.model,
      heartbeat_interval: TIMING.HEARTBEAT_INTERVAL / 1000,
    };

    const envelope = createEnvelope(MESSAGE_TYPES.HELLO, this.state.nodeId, payload);

    // Simulate API call
    const response = await this.simulateApiCall<HelloResponse>('/a2a/hello', envelope);

    this.state.nodeId = response.node_id;
    this.state.nodeSecret = response.node_secret;
    this.state.registered = true;
    this.state.status = 'alive';
    this.state.lastHeartbeat = new Date().toISOString();

    return response;
  }

  /**
   * Start heartbeat interval
   */
  startHeartbeat(hubUrl: string, intervalMs: number = TIMING.HEARTBEAT_INTERVAL): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.sendHeartbeat(hubUrl);
      } catch (error) {
        console.error('Heartbeat failed:', error);
        this.state.status = 'dead';
      }
    }, intervalMs);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Send heartbeat
   */
  async sendHeartbeat(hubUrl: string): Promise<HeartbeatResponse> {
    const payload: HeartbeatPayload = {
      status: this.state.status,
      pending_events: this.pendingEvents.size,
      available_work: true,
      commitment_updates: {},
    };

    const envelope = createEnvelope(MESSAGE_TYPES.HEARTBEAT, this.state.nodeId, payload);
    const response = await this.simulateApiCall<HeartbeatResponse>('/a2a/heartbeat', envelope);

    this.state.lastHeartbeat = new Date().toISOString();
    this.state.status = 'alive';

    // Process pending events
    if (response.pending_events && response.pending_events.length > 0) {
      for (const event of response.pending_events) {
        this.pendingEvents.set(event.event_id, event.data);
      }
    }

    return response;
  }

  /**
   * Publish assets (Bundle)
   */
  async publish(hubUrl: string, assets: Record<string, unknown>[]): Promise<PublishResponse> {
    if (!this.state.registered) {
      throw new Error('Node not registered');
    }

    const payload: PublishPayload = { assets };
    const envelope = createEnvelope(MESSAGE_TYPES.PUBLISH, this.state.nodeId, payload);

    return this.simulateApiCall<PublishResponse>('/a2a/publish', envelope);
  }

  /**
   * Fetch assets
   */
  async fetch(hubUrl: string, query?: FetchPayload['query'], searchOnly = false): Promise<FetchResponse> {
    const payload: FetchPayload = { query, search_only: searchOnly };
    const envelope = createEnvelope(MESSAGE_TYPES.FETCH, this.state.nodeId, payload);

    return this.simulateApiCall<FetchResponse>('/a2a/fetch', envelope);
  }

  /**
   * Submit validation report
   */
  async report(hubUrl: string, assetId: string, validated: boolean, confidence: number): Promise<ReportResponse> {
    const payload: ReportPayload = {
      validation_report: {
        asset_id: assetId,
        validated,
        confidence,
      },
    };
    const envelope = createEnvelope(MESSAGE_TYPES.REPORT, this.state.nodeId, payload);

    return this.simulateApiCall<ReportResponse>('/a2a/report', envelope);
  }

  /**
   * Revoke asset
   */
  async revoke(hubUrl: string, assetId: string, reason: string): Promise<RevokeResponse> {
    const payload: RevokePayload = { asset_id: assetId, reason };
    const envelope = createEnvelope(MESSAGE_TYPES.REVOKE, this.state.nodeId, payload);

    return this.simulateApiCall<RevokeResponse>('/a2a/revoke', envelope);
  }

  /**
   * Compute asset ID for an asset
   */
  computeAssetId(asset: Record<string, unknown>): string {
    return computeAssetId(asset);
  }

  /**
   * Simulate API call (for testing)
   * In real implementation, this would be an HTTP request
   */
  private async simulateApiCall<T>(
    endpoint: string,
    envelope: ProtocolEnvelope<unknown>
  ): Promise<T> {
    // Validate envelope
    const validation = validateEnvelope(envelope);
    if (!validation.valid) {
      throw new Error(`Invalid envelope: ${validation.error}`);
    }

    // Check authentication
    if (!this.state.registered && endpoint !== '/a2a/hello') {
      throw new Error('Node not registered');
    }

    // Simulate response based on message type
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate network latency

    switch (envelope.message_type) {
      case MESSAGE_TYPES.HELLO:
        return {
          node_id: this.state.nodeId,
          node_secret: hashSecret(this.state.nodeId + Date.now()),
          claim_code: `claim_${Date.now()}`,
          claim_url: `https://hub.evomap.ai/claim/${Date.now()}`,
          registered_at: new Date().toISOString(),
        } as unknown as T;

      case MESSAGE_TYPES.HEARTBEAT:
        return {
          acked: true,
          pending_events: [],
          new_tasks: [],
        } as unknown as T;

      case MESSAGE_TYPES.PUBLISH:
        return {
          bundle_id: `bundle_${Date.now()}`,
          asset_ids: (envelope.payload as { assets: Array<{ asset_id?: string }> }).assets.map(
            a => a.asset_id || computeAssetId(removeField(a as Record<string, unknown>, 'asset_id'))
          ),
          status: 'published',
          validation_results: [],
        } as unknown as T;

      case MESSAGE_TYPES.FETCH:
        return {
          assets: [],
          total_count: 0,
          search_only: (envelope.payload as { search_only?: boolean }).search_only,
        } as unknown as T;

      case MESSAGE_TYPES.REPORT:
        return {
          acknowledged: true,
          reputation_delta: 5,
        } as unknown as T;

      case MESSAGE_TYPES.REVOKE:
        return {
          revoked: true,
          asset_id: (envelope.payload as { asset_id: string }).asset_id,
        } as unknown as T;

      default:
        throw new Error(`Unknown message type: ${envelope.message_type}`);
    }
  }
}

/**
 * Create a new node with registration
 */
export async function createAndRegisterNode(
  hubUrl: string,
  config: NodeConfig = {}
): Promise<EvoMapNode> {
  const node = new EvoMapNode(config);
  await node.register(hubUrl);
  return node;
}
