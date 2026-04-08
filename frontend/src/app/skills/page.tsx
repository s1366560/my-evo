"use client";

import { SkillCard } from "@/components/skills/SkillCard";

interface MockSkill {
  id: string;
  name: string;
  author: string;
  gdiScore: number;
  downloads: number;
  description: string;
  tags: string[];
}

const mockSkills: MockSkill[] = [
  { id: "1", name: "ContextAssembler", author: "NeuroCore", gdiScore: 95, downloads: 12843, description: "Efficiently assembles and compresses conversation context for long-horizon tasks.", tags: ["nlp", "context", "reasoning"] },
  { id: "2", name: "RLHF-Pipeline", author: "SynthLab", gdiScore: 91, downloads: 8234, description: "End-to-end reinforcement learning from human feedback pipeline.", tags: ["rl", "training", "alignment"] },
  { id: "3", name: "CodeSynth-v4", author: "CodeForge", gdiScore: 97, downloads: 21056, description: "Advanced code generation with multi-language support and test generation.", tags: ["coding", "synthesis", "testing"] },
  { id: "4", name: "VisionEncoder", author: "PixelMind", gdiScore: 88, downloads: 6547, description: "High-quality image feature extraction and encoding for multi-modal agents.", tags: ["vision", "encoding", "multi-modal"] },
  { id: "5", name: "MathSolver-Pro", author: "NumLogic", gdiScore: 93, downloads: 11230, description: "Step-by-step mathematical reasoning with symbolic and numeric solving.", tags: ["math", "reasoning", "symbols"] },
  { id: "6", name: "SecurityScanner", author: "SecuPath", gdiScore: 79, downloads: 3891, description: "Automated security vulnerability scanning for agent-generated code.", tags: ["security", "analysis", "coding"] },
  { id: "7", name: "PromptOptimizer", author: "PromptWiz", gdiScore: 86, downloads: 9876, description: "Automatic prompt optimization using evolutionary strategies.", tags: ["nlp", "prompting", "optimization"] },
  { id: "8", name: "DataAugmentor", author: "DataForge", gdiScore: 82, downloads: 5432, description: "Synthetic data generation and augmentation for model fine-tuning.", tags: ["data", "augmentation", "training"] },
  { id: "9", name: "NLU-Enhanced", author: "Linguist", gdiScore: 89, downloads: 7654, description: "Enhanced natural language understanding with intent classification and entity extraction.", tags: ["nlu", "nlp", "classification"] },
  { id: "10", name: "InferenceEngine", author: "FastMind", gdiScore: 96, downloads: 15432, description: "High-throughput inference optimization with batching and caching.", tags: ["inference", "performance", "optimization"] },
  { id: "11", name: "TextSummarizer", author: "TextAI", gdiScore: 84, downloads: 6123, description: "Abstractive and extractive text summarization across multiple domains.", tags: ["nlp", "summarization", "text"] },
  { id: "12", name: "GraphReasoner", author: "NeoLogic", gdiScore: 90, downloads: 4321, description: "Knowledge graph traversal and multi-hop logical reasoning.", tags: ["reasoning", "graph", "knowledge"] },
];

export default function SkillsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pb-16 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Skill Marketplace</h1>
        <p className="text-[var(--color-muted-foreground)]">
          Discover and use community-built skills to enhance your EvoMap agents.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <input
          type="search"
          placeholder="Search skills..."
          className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input-background)] px-4 pr-10 text-sm placeholder-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <svg
          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Skill Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockSkills.map((skill) => (
          <SkillCard key={skill.id} skill={skill} />
        ))}
      </div>
    </div>
  );
}
