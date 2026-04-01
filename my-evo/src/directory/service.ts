/**
 * Directory Service - Agent Search & Direct Message
 */

import { randomUUID } from 'crypto';

export interface AgentProfile {
  node_id: string;
  model: string;
  capabilities: string[];
  reputation: number;
  gdi_score: number;
  status: 'online' | 'offline' | 'busy';
  metadata: Record<string, any>;
  registered_at: number;
  last_active: number;
}

export interface DirectMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  read: boolean;
  created_at: number;
}

export interface DirectoryQuery {
  q?: string;
  capabilities?: string[];
  min_reputation?: number;
  limit?: number;
}

export interface DirectoryResult {
  agents: AgentProfile[];
  total: number;
  query_time_ms: number;
}

const agents: Map<string, AgentProfile> = new Map();
const directMessages: Map<string, DirectMessage[]> = new Map();
const messageInbox: Map<string, DirectMessage[]> = new Map();

export function registerAgent(agent: Omit<AgentProfile, 'registered_at' | 'last_active'>): AgentProfile {
  const profile: AgentProfile = {
    ...agent,
    registered_at: Date.now(),
    last_active: Date.now(),
  };
  agents.set(profile.node_id, profile);
  return profile;
}

export function updateAgentStatus(nodeId: string, status: 'online' | 'offline' | 'busy'): AgentProfile | undefined {
  const agent = agents.get(nodeId);
  if (!agent) return undefined;
  const updated: AgentProfile = { ...agent, status, last_active: Date.now() };
  agents.set(nodeId, updated);
  return updated;
}

export function getAgent(nodeId: string): AgentProfile | undefined {
  const agent = agents.get(nodeId);
  if (!agent) return undefined;
  const updated: AgentProfile = { ...agent, last_active: Date.now() };
  agents.set(nodeId, updated);
  return updated;
}

export function searchAgents(query: DirectoryQuery): DirectoryResult {
  const startTime = Date.now();
  let results = Array.from(agents.values());
  
  if (query.capabilities && query.capabilities.length > 0) {
    results = results.filter(agent =>
      query.capabilities!.some(cap => agent.capabilities.includes(cap))
    );
  }
  
  if (query.min_reputation !== undefined) {
    results = results.filter(agent => agent.reputation >= query.min_reputation!);
  }
  
  if (query.q) {
    const q = query.q.toLowerCase();
    results = results.filter(agent =>
      agent.node_id.toLowerCase().includes(q) ||
      agent.model.toLowerCase().includes(q) ||
      agent.capabilities.some(c => c.toLowerCase().includes(q))
    );
  }
  
  results.sort((a, b) => b.reputation - a.reputation);
  
  const limit = query.limit || 20;
  return {
    agents: results.slice(0, limit),
    total: results.length,
    query_time_ms: Date.now() - startTime,
  };
}

export function sendDirectMessage(from: string, to: string, content: string): DirectMessage {
  const message: DirectMessage = {
    id: `dm_${randomUUID().slice(0, 8)}`,
    from, to, content, read: false, created_at: Date.now(),
  };
  
  const sent = directMessages.get(from) || [];
  sent.push(message);
  directMessages.set(from, sent);
  
  const inbox = messageInbox.get(to) || [];
  inbox.push(message);
  messageInbox.set(to, inbox);
  
  return message;
}

export function getInbox(nodeId: string): DirectMessage[] {
  return (messageInbox.get(nodeId) || []).sort((a, b) => b.created_at - a.created_at);
}

export function getUnreadCount(nodeId: string): number {
  return (messageInbox.get(nodeId) || []).filter(m => !m.read).length;
}

export function markAsRead(messageId: string, recipientId: string): boolean {
  const inbox = messageInbox.get(recipientId);
  if (!inbox) return false;
  const message = inbox.find(m => m.id === messageId && m.to === recipientId);
  if (!message) return false;
  message.read = true;
  return true;
}

export function markAllAsRead(nodeId: string): number {
  const inbox = messageInbox.get(nodeId);
  if (!inbox) return 0;
  let count = 0;
  for (const m of inbox) { if (!m.read) { m.read = true; count++; } }
  return count;
}

export function getSentMessages(nodeId: string): DirectMessage[] {
  return (directMessages.get(nodeId) || []).sort((a, b) => b.created_at - a.created_at);
}

export function getDirectoryStats() {
  const allAgents = Array.from(agents.values());
  const avgRep = allAgents.length > 0 ? allAgents.reduce((s, a) => s + a.reputation, 0) / allAgents.length : 0;
  const capCounts: Record<string, number> = {};
  for (const a of allAgents) { for (const c of a.capabilities) { capCounts[c] = (capCounts[c] || 0) + 1; } }
  const topCaps = Object.entries(capCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
  return { total_agents: allAgents.length, online_agents: allAgents.filter(a => a.status === 'online').length, average_reputation: Math.round(avgRep * 10) / 10, top_capabilities: topCaps };
}
