/**
 * Workspace System Type Definitions
 * 
 * Defines types for:
 * - Workspace Leader and Worker models
 * - Task management and state machines
 * - Preflight Evidence and Verification
 * - API request/response types
 */

// ============================================================================
// Enums and Constants
// ============================================================================

export type LeaderStatus = 
  | 'forming'     // 组建团队中
  | 'active'      // 活跃执行中
  | 'waiting'     // 等待 Worker 响应
  | 'completing'  // 汇总结果中
  | 'completed'   // 全部完成
  | 'failed';    // 执行失败

export type WorkerStatus = 
  | 'idle'        // 空闲，可接收任务
  | 'assigned'    // 已分配任务
  | 'in_progress' // 执行中
  | 'submitted'   // 已提交，等待验收
  | 'completed'  // 任务完成
  | 'failed'     // 任务失败
  | 'blocked';   // 被阻塞

export type TaskStatus = 
  | 'pending'     // 待分配
  | 'assigned'    // 已分配
  | 'in_progress' // 执行中
  | 'submitted'   // 已提交
  | 'completed'   // 已完成
  | 'failed'      // 失败
  | 'blocked';    // 阻塞

export type AttemptStatus = 
  | 'created'     // 已创建
  | 'running'     // 运行中
  | 'completed'   // 已完成
  | 'blocked';   // 阻塞

export type PreflightCheckKind = 
  | 'git_status'      // Git 状态检查
  | 'read_progress'   // 读取进度检查
  | 'file_exists'     // 文件存在性检查
  | 'test_run'        // 测试运行结果
  | 'build_status'    // 构建状态检查
  | 'api_contract'    // API 契约验证
  | 'data_model'      // 数据模型验证
  | 'custom';         // 自定义检查

export type EvidenceType = 
  | 'text'       // 文本输出
  | 'json'       // JSON 数据
  | 'file'       // 文件路径
  | 'screenshot' // 截图
  | 'log';       // 日志片段

export type CaptureMethod = 
  | 'command'    // 命令执行
  | 'file_read'  // 文件读取
  | 'api_call'   // API 调用
  | 'system';    // 系统生成

export type VerificationDimension = 
  | 'completeness' // 任务完整性
  | 'consistency'  // 契约一致性
  | 'freshness'    // 结果新鲜度
  | 'preflight';   // Preflight 检查

// ============================================================================
// Core Interfaces
// ============================================================================

/** Workspace Leader - 执行团队管理器 */
export interface WorkspaceLeader {
  id: string;
  leader_id: string;
  workspace_id: string;
  root_goal_id: string;
  status: LeaderStatus;
  team_size: number;
  active_workers: number;
  created_at: string;
  updated_at: string;
  last_heartbeat: string;
}

/** Team Member - 团队成员 */
export interface TeamMember {
  id: string;
  leader_id: string;
  worker_id: string;
  role: WorkerRole;
  status: 'idle' | 'busy' | 'offline';
  assigned_tasks: string[];
  joined_at: string;
}

export type WorkerRole = 'architect' | 'builder' | 'verifier' | 'specialist';

/** Workspace Task - 工作任务 */
export interface WorkspaceTask {
  id: string;
  task_id: string;
  workspace_id: string;
  leader_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assigned_worker_id: string | null;
  role: WorkerRole | null;
  progress_pct: number;
  current_step: string | null;
  preflight_config: PreflightConfig | null;
  deadline: string | null;
  dependencies: string[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/** Task Attempt - 任务尝试 */
export interface TaskAttempt {
  id: string;
  attempt_id: string;
  task_id: string;
  worker_id: string;
  status: AttemptStatus;
  started_at: string | null;
  completed_at: string | null;
  summary: string | null;
  artifacts: string[];
  verifications: string[];
}

/** Preflight Config - Preflight 检查配置 */
export interface PreflightConfig {
  checks: string[];
  required: boolean;
}

/** Preflight Check - 单个检查项 */
export interface PreflightCheck {
  check_id: string;
  kind: string;
  command: string | null;
  required: boolean;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  evidence: string | null;
  completed_at: string | null;
}

/** Preflight Evidence - 证据内容 */
export interface PreflightEvidence {
  evidence_id: string;
  task_id: string;
  worker_id: string;
  check_id: string;
  check_kind: PreflightCheckKind;
  evidence_type: EvidenceType;
  evidence_content: string | object;
  captured_at: string;
  capture_method: CaptureMethod;
  context?: Record<string, unknown>;
  verified: boolean;
  verified_by?: string;
  verified_at?: string;
}

/** Preflight Result - 检查结果 */
export interface PreflightResult {
  id: string;
  task_id: string;
  attempt_id: string;
  check_id: string;
  kind: string;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  evidence: string | null;
  captured_at: string | null;
  created_at: string;
}

/** Verification Result - 验证结果 */
export interface VerificationResult {
  dimension: VerificationDimension;
  passed: boolean;
  score: number;
  messages: string[];
  details?: Record<string, unknown>;
}

/** Execution Metrics - 执行指标 */
export interface ExecutionMetrics {
  duration_ms?: number;
  steps_completed?: number;
  total_steps?: number;
  files_modified?: number;
  lines_added?: number;
  lines_removed?: number;
  test_cases?: number;
  test_passed?: number;
  memory_peak_mb?: number;
  cpu_time_ms?: number;
  network_requests?: number;
}

// ============================================================================
// Worker Related Types
// ============================================================================

/** Workspace Worker - 工作空间 Worker */
export interface WorkspaceWorker {
  id: string;
  worker_id: string;
  node_id: string;
  agent_id: string;
  status: WorkerStatus;
  capabilities: Capability[];
  max_concurrent_tasks: number;
  current_tasks: string[];
  completed_tasks: string[];
  failed_tasks: string[];
  registered_at: string;
  last_heartbeat: string;
  last_state_change: string;
}

/** Capability - Worker 能力 */
export interface Capability {
  category: WorkerRole;
  skills: string[];
  domains: string[];
  tools: string[];
}

/** Task Binding - 任务绑定 */
export interface TaskBinding {
  task_id: string;
  workspace_id: string;
  workspace_task_id: string;
  attempt_id: string;
  leader_id: string;
  assigned_at: string;
  deadline: string;
  status: 'assigned' | 'in_progress' | 'submitted' | 'completed' | 'failed';
  preflight_checks: PreflightCheck[];
  progress_pct: number;
  current_step: string | null;
}

/** Heartbeat Extension - 心跳扩展 */
export interface HeartbeatExtension {
  task_id: string;
  worker_id: string;
  extended_until: string;
  reason: 'tool_call' | 'compile' | 'test_run' | 'file_operation';
  estimated_duration_ms: number;
}

/** State Lock - 状态锁定 */
export interface StateLock {
  worker_id: string;
  task_id: string;
  locked_by: 'heartbeat' | 'extension' | 'tool_call';
  locked_at: string;
  expires_at: string;
}

// ============================================================================
// Leader Decision Types
// ============================================================================

/** Match Score - 匹配分数 */
export interface MatchScore {
  worker_id: string;
  role_match: number;
  skill_overlap: number;
  availability: number;
  reputation: number;
  load_factor: number;
  final_score: number;
}

/** Team Formation Decision - 团队组建决策 */
export interface TeamFormationDecision {
  required_roles: WorkerRole[];
  min_team_size: number;
  max_team_size: number;
  selected_workers: string[];
  formation_strategy: 'balanced' | 'specialist' | 'generalist';
}

/** Leader Configuration - Leader 配置 */
export interface LeaderConfig {
  auto_form_team: boolean;
  team_size: number;
  roles: WorkerRole[];
  worker_pool_id?: string;
  match_strategy?: 'balanced' | 'specialist' | 'generalist';
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/** Create Workspace Request */
export interface CreateWorkspaceRequest {
  name: string;
  description: string;
  root_goal: string;
  leader_config: LeaderConfig;
}

/** Create Workspace Response */
export interface CreateWorkspaceResponse {
  workspace_id: string;
  leader_id: string;
  root_goal_id: string;
  name: string;
  status: LeaderStatus;
  created_at: string;
  preflight_required: boolean;
}

/** Workspace Status Response */
export interface WorkspaceStatusResponse {
  workspace_id: string;
  name: string;
  description: string;
  status: LeaderStatus;
  created_at: string;
  updated_at: string;
  root_goal: RootGoalInfo;
  leader: LeaderInfo;
  stats: WorkspaceStats;
}

/** Root Goal Info */
export interface RootGoalInfo {
  goal_id: string;
  description: string;
  progress: number;
  total_tasks: number;
  completed_tasks: number;
  child_tasks: ChildTaskInfo[];
}

/** Child Task Info */
export interface ChildTaskInfo {
  task_id: string;
  title: string;
  status: TaskStatus;
  progress_pct: number;
}

/** Leader Info */
export interface LeaderInfo {
  leader_id: string;
  status: LeaderStatus;
  team_size: number;
  team_members: TeamMember[];
}

/** Workspace Stats */
export interface WorkspaceStats {
  total_tasks: number;
  completed: number;
  in_progress: number;
  blocked: number;
  pending: number;
}

/** Create Task Request */
export interface CreateTaskRequest {
  title: string;
  description: string;
  assigned_worker_id?: string;
  role?: WorkerRole;
  preflight_config?: PreflightConfig;
  deadline?: string;
  priority?: 'low' | 'medium' | 'high';
  dependencies?: string[];
}

/** Create Task Response */
export interface CreateTaskResponse {
  task_id: string;
  workspace_task_id: string;
  workspace_id: string;
  attempt_id: string;
  status: TaskStatus;
  assigned_worker_id: string | null;
  assigned_at: string;
  deadline: string | null;
}

/** Worker Report Request */
export interface WorkerReportRequest {
  status: WorkerStatus;
  progress_pct: number;
  current_step: string;
  next_steps?: string[];
  preflight_evidence?: PreflightEvidence[];
  heartbeat_extension?: {
    reason: HeartbeatExtension['reason'];
    estimated_duration_ms: number;
  };
}

/** Worker Report Response */
export interface WorkerReportResponse {
  acknowledged: boolean;
  task_status: TaskStatus;
  next_heartbeat_in_ms: number;
  extension_granted: boolean;
  extension_expires_at?: string;
  pending_dependencies: string[];
  messages: string[];
}

/** Complete Task Request */
export interface CompleteTaskRequest {
  summary: string;
  artifacts: string[];
  verifications: string[];
  preflight_checklist: PreflightCheck[];
  execution_metrics?: ExecutionMetrics;
  next_worker_notes?: string;
}

/** Complete Task Response */
export interface CompleteTaskResponse {
  task_id: string;
  status: TaskStatus;
  completed_at: string;
  verification_results: VerificationResult[];
  artifacts: string[];
  worker_reward?: {
    reputation_delta: number;
    credits_earned: number;
  };
}

/** Preflight Execution Request */
export interface PreflightExecuteRequest {
  checks: string[];
  workspace_id?: string;
  task_id?: string;
}

/** Preflight Execution Response */
export interface PreflightExecuteResponse {
  results: PreflightCheck[];
  overall_status: 'passed' | 'failed' | 'partial';
  failed_checks: string[];
}

// ============================================================================
// Completion Report (for Verifier Integration)
// ============================================================================

export interface CompletionReport {
  task_id: string;
  status: AttemptStatus;
  summary: string;
  artifacts?: string[];
  verifications?: string[];
  preflight_checklist?: PreflightCheck[];
  dependency_verification?: Record<string, boolean>;
  resource_validation?: Record<string, unknown>;
  execution_metrics?: ExecutionMetrics;
  error?: string | null;
  timestamp: string;
}

// ============================================================================
// Standard Check Definitions
// ============================================================================

export interface StandardCheckDefinition {
  check_id: string;
  name: string;
  kind: PreflightCheckKind;
  description: string;
  command: string | null;
  required: boolean;
  categories: string[];
}

/** Standard Preflight Checks */
export const STANDARD_PREFLIGHT_CHECKS: Record<string, StandardCheckDefinition> = {
  'git-status': {
    check_id: 'git-status',
    name: 'Git Status',
    kind: 'git_status',
    description: 'Check for uncommitted changes',
    command: 'git status --short',
    required: true,
    categories: ['code_change', 'default'],
  },
  'git-diff': {
    check_id: 'git-diff',
    name: 'Git Diff',
    kind: 'git_status',
    description: 'Show changes summary',
    command: 'git diff --stat',
    required: false,
    categories: ['code_change'],
  },
  'read-progress': {
    check_id: 'read-progress',
    name: 'Read Progress',
    kind: 'read_progress',
    description: 'Verify checkpoint/state file',
    command: null,
    required: true,
    categories: ['default'],
  },
  'build': {
    check_id: 'build',
    name: 'Build Check',
    kind: 'build_status',
    description: 'Run build process',
    command: 'npm run build 2>&1',
    required: true,
    categories: ['build'],
  },
  'test': {
    check_id: 'test',
    name: 'Test Run',
    kind: 'test_run',
    description: 'Run test suite',
    command: 'npm test -- --passWithNoTests 2>&1',
    required: true,
    categories: ['test'],
  },
  'lint': {
    check_id: 'lint',
    name: 'Lint Check',
    kind: 'custom',
    description: 'Run linter',
    command: 'npm run lint 2>&1 || true',
    required: false,
    categories: ['code_change'],
  },
};

// ============================================================================
// Stale Recovery Rules
// ============================================================================

export const STALE_RECOVERY_RULES = {
  // 不标记为 blocked 的情况
  NOT_BLOCKED: [
    'heartbeat_received_within_5min',
    'has_active_extension',
    'has_tool_call_in_progress',
    'has_subagent_running',
  ] as const,
  
  // 标记为 blocked 的条件
  BLOCKED_WHEN: [
    'no_heartbeat_for_10min_without_extension',
    'heartbeat_heartbeat_status === "blocked"',
    'explicit_blocked_signal_from_worker',
  ] as const,
  
  // 心跳间隔配置
  HEARTBEAT_INTERVAL_MS: 60000,      // 1 分钟
  HEARTBEAT_GRACE_MS: 300000,        // 5 分钟宽限期
  BLOCK_THRESHOLD_MS: 600000,        // 10 分钟无心跳则标记 blocked
  
  // 心跳扩展最大时长
  MAX_EXTENSION_MS: 300000,          // 5 分钟
};

// ============================================================================
// Verification Thresholds
// ============================================================================

export const VERIFICATION_THRESHOLDS = {
  completeness: { threshold: 80, weight: 0.30 },
  consistency: { threshold: 70, weight: 0.25 },
  freshness: { threshold: 100, weight: 0.20 },
  preflight: { threshold: 100, weight: 0.25 },
};

// ============================================================================
// Worker Match Weights
// ============================================================================

export const WORKER_MATCH_WEIGHTS = {
  role_match: 0.30,
  skill_overlap: 0.25,
  availability: 0.20,
  reputation: 0.15,
  load_factor: 0.10,
};

// ============================================================================
// Workspace Chat (Group Chat) Types
// ============================================================================

export type WorkspaceMessageType = 'text' | 'system' | 'task_update' | 'mention';

export interface WorkspaceMessage {
  id: string;
  message_id: string;
  workspace_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  message_type: WorkspaceMessageType;
  metadata: Record<string, unknown>;
  mentions: string[];
  reply_to: string | null;
  reactions: WorkspaceMessageReaction[];
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMessageReaction {
  emoji: string;
  user_id: string;
  created_at: string;
}

export interface SendWorkspaceMessageRequest {
  content: string;
  message_type?: WorkspaceMessageType;
  mentions?: string[];
  reply_to?: string;
  metadata?: Record<string, unknown>;
}

export interface SendWorkspaceMessageResponse {
  message_id: string;
  workspace_id: string;
  sender_id: string;
  created_at: string;
}

export interface ListWorkspaceMessagesRequest {
  workspace_id: string;
  limit?: number;
  before?: string;  // cursor for pagination (message_id)
  message_type?: WorkspaceMessageType;
}

export interface ListWorkspaceMessagesResponse {
  messages: WorkspaceMessage[];
  has_more: boolean;
  next_cursor?: string;
}

export interface WorkspaceChatReactionRequest {
  emoji: string;
}

export interface PinMessageRequest {
  is_pinned: boolean;
}
