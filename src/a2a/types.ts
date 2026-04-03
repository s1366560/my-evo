import type {
  HelloPayload,
  HelloResponse,
  HeartbeatPayload,
  HeartbeatResponse,
  NodeInfo,
  NodeStatus,
} from '../shared/types';

export interface RegisterNodeResult {
  node_id: string;
  node_secret: string;
  claim_code: string;
  referral_code: string;
  status: NodeStatus;
  trust_level: string;
  credit_balance: number;
}

export interface NetworkStats {
  total_nodes: number;
  alive_nodes: number;
  total_genes: number;
  total_capsules: number;
}

export interface NodeStatusCheck {
  status: NodeStatus;
  last_seen: Date;
}

export { HelloPayload, HelloResponse, HeartbeatPayload, HeartbeatResponse, NodeInfo };
