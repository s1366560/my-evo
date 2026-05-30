"""
Durable Verifier - Multi-dimensional Worker Report Validation with Checkpoint/Resume Support
"""
import hashlib, json, sqlite3
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Optional

CHECKPOINT_TTL_MS = 7 * 24 * 60 * 60 * 1000
RESULT_TTL_MS = 30 * 24 * 60 * 60 * 1000
MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000

class TaskStatus(str, Enum):
    PENDING = "PENDING"; VERIFYING = "VERIFYING"; PROGRESS = "PROGRESS"
    COMPLETED = "COMPLETED"; FAILED = "FAILED"; BLOCKED = "BLOCKED"

class VerificationDimension(str, Enum):
    COMPLETENESS = "completeness"; CONSISTENCY = "consistency"
    FRESHNESS = "freshness"; PREFLIGHT = "preflight"

class StorageBackend(str, Enum):
    JSON = "json"; DB = "db"; BOTH = "both"

@dataclass
class PreflightCheck:
    check_id: str; kind: str; command: Optional[str] = None; required: bool = True
    status: str = "pending"; evidence: Optional[str] = None; completed_at: Optional[str] = None
    def to_dict(self) -> dict: return {k: v for k, v in asdict(self).items() if v is not None}
    @classmethod
    def from_dict(cls, d: dict) -> "PreflightCheck":
        return cls(check_id=d["check_id"], kind=d["kind"], command=d.get("command"),
            required=d.get("required", True), status=d.get("status", "pending"),
            evidence=d.get("evidence"), completed_at=d.get("completed_at"))

@dataclass
class VerificationResult:
    dimension: str; passed: bool; score: float; messages: list; details: Optional[dict] = None
    def to_dict(self) -> dict: return {"dimension": self.dimension, "passed": self.passed,
        "score": self.score, "messages": self.messages, "details": self.details}
    @classmethod
    def from_dict(cls, d: dict) -> "VerificationResult":
        return cls(dimension=d["dimension"], passed=d["passed"], score=d["score"],
            messages=d.get("messages", []), details=d.get("details"))

@dataclass
class ExecutionMetrics:
    duration_ms: Optional[int] = None; steps_completed: Optional[int] = None
    total_steps: Optional[int] = None; memory_peak_mb: Optional[float] = None
    cpu_time_ms: Optional[int] = None; network_requests: Optional[int] = None
    def to_dict(self) -> dict: return {k: v for k, v in asdict(self).items() if v is not None}
    @classmethod
    def from_dict(cls, d: dict) -> "ExecutionMetrics":
        return cls(**{k: v for k, v in d.items() if v is not None})

@dataclass
class CompletionReport:
    task_id: str; status: str; summary: str; timestamp: str = ""
    artifacts: Optional[list] = None; verifications: Optional[list] = None
    preflight_checklist: Optional[list] = None; dependency_verification: Optional[dict] = None
    resource_validation: Optional[dict] = None; execution_metrics: Optional[dict] = None
    error: Optional[str] = None
    def __post_init__(self):
        if not self.timestamp: self.timestamp = datetime.now(timezone.utc).isoformat()
    def to_dict(self) -> dict:
        r = {"task_id": self.task_id, "status": self.status, "summary": self.summary, "timestamp": self.timestamp}
        for f in ["artifacts","verifications","preflight_checklist","dependency_verification",
                  "resource_validation","execution_metrics","error"]:
            v = getattr(self, f)
            if v is not None: r[f] = v
        return r
    @classmethod
    def from_dict(cls, d: dict) -> "CompletionReport":
        return cls(task_id=d["task_id"], status=d["status"], summary=d["summary"],
            artifacts=d.get("artifacts"), verifications=d.get("verifications"),
            preflight_checklist=d.get("preflight_checklist"),
            dependency_verification=d.get("dependency_verification"),
            resource_validation=d.get("resource_validation"),
            execution_metrics=d.get("execution_metrics"),
            error=d.get("error"), timestamp=d.get("timestamp",""))

@dataclass
class TaskCheckpoint:
    task_id: str; status: str; position: int; total: int; step: str
    progress_pct: float; created_at: str; updated_at: str; expires_at: str
    last_asset_id: Optional[str] = None; verifications: Optional[list] = None; error: Optional[str] = None
    def to_dict(self) -> dict:
        return {"task_id": self.task_id, "status": self.status, "position": self.position,
            "total": self.total, "step": self.step, "progress_pct": self.progress_pct,
            "created_at": self.created_at, "updated_at": self.updated_at, "expires_at": self.expires_at,
            "last_asset_id": self.last_asset_id, "verifications": self.verifications, "error": self.error}
    @classmethod
    def from_dict(cls, d: dict) -> "TaskCheckpoint":
        return cls(task_id=d["task_id"], status=d["status"], position=d["position"], total=d["total"],
            step=d["step"], progress_pct=d["progress_pct"], created_at=d["created_at"],
            updated_at=d["updated_at"], expires_at=d["expires_at"],
            last_asset_id=d.get("last_asset_id"), verifications=d.get("verifications"), error=d.get("error"))

@dataclass
class StoredResult:
    task_id: str; checkpoint: dict; report: dict; storage_backend: str
    persisted_at: str; checksum: str
    def to_dict(self) -> dict: return asdict(self)
    @classmethod
    def from_dict(cls, d: dict) -> "StoredResult": return cls(**d)

@dataclass
class ResumeResult:
    can_resume: bool; checkpoint: Optional[dict] = None; message: str = ""
