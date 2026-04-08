export type NodeStatus = "alive" | "dead" | "quarantined";

export type QuarantineLevel = "L1" | "L2" | "L3";

export interface Node {
  node_id: string;
  node_name?: string;
  status: NodeStatus;
  quarantine_level?: QuarantineLevel;
  credits: number;
  reputation_score: number;
  registered_at: string;
  last_seen_at: string;
  capabilities?: string[];
}

export interface NodeStats {
  total_nodes: number;
  alive_nodes: number;
  total_genes: number;
  total_capsules: number;
  total_recipes: number;
  active_swarms: number;
}
