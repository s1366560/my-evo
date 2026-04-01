"use client";

import { SendHorizonal, Sparkles, Bot, Cpu } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";

type ChatStatus = "ready" | "submitted" | "streaming" | "error";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: "text"; text: string }>;
};

function makeUserMessage(text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    parts: [{ type: "text", text }],
  };
}

function makeAssistantMessage(text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    parts: [{ type: "text", text }],
  };
}

function simulateEvolutionAnswer(input: string): string {
  const cues = [
    "Swarm decomposition: break into 3 subtasks (signal extraction, confidence grading, lineage validation).",
    "Reputation impact: propose +8 credibility if validation reports stay above 0.82 confidence.",
    "Risk: semantic overlap above 0.9 may trigger duplicate capsule penalty.",
  ];

  const pick = cues[Math.floor(Math.random() * cues.length)];
  return `已收到任务：${input}\n\n${pick}\n\n建议下一步：先发布一个低碳 Gene 版本，再触发 /a2a/sync/check 完成回写。`;
}

export default function HomePage() {
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [messages, setMessages] = useState<ChatMessage[]>([
    makeAssistantMessage("欢迎来到 EvoMap Console。你可以直接输入目标，我会给出可执行的演化方案。"),
  ]);

  const headline = useMemo(
    () => ({
      title: "EvoMap AI Console",
      subtitle: "用 ai-elements 重构的协作前端：更聚焦、更可对话、更适合多 Agent 进化流程。",
    }),
    []
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6 grid gap-4 rounded-3xl border border-border/80 bg-card/85 p-5 shadow-sm backdrop-blur md:grid-cols-[1fr_auto] md:items-end md:p-8">
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            <Sparkles className="size-3.5" />
            ai-elements rebuild
          </p>
          <h1 className="font-[var(--font-title)] text-2xl font-extrabold tracking-tight md:text-4xl">
            {headline.title}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            {headline.subtitle}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs md:w-64">
          <div className="rounded-2xl border border-border bg-secondary/70 p-3">
            <p className="mb-1 text-muted-foreground">Mode</p>
            <p className="inline-flex items-center gap-1 font-semibold">
              <Bot className="size-3.5" />
              Swarm Coach
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-secondary/70 p-3">
            <p className="mb-1 text-muted-foreground">Engine</p>
            <p className="inline-flex items-center gap-1 font-semibold">
              <Cpu className="size-3.5" />
              evo-sim
            </p>
          </div>
        </div>
      </header>

      <section className="flex min-h-[68vh] flex-1 flex-col overflow-hidden rounded-3xl border border-border/80 bg-card/88 shadow-sm backdrop-blur">
        <Conversation>
          <ConversationContent className="px-4 pb-5 pt-6 md:px-6">
            {messages.length === 0 ? (
              <ConversationEmptyState
                title="开始你的第一条演化指令"
                description="例如：为资产检索接口设计低碳高置信的重试策略。"
              />
            ) : (
              messages.map((message) => {
                const text = message.parts
                  .filter((part) => part.type === "text")
                  .map((part) => part.text)
                  .join("\n");

                return (
                  <Message from={message.role} key={message.id}>
                    <MessageContent>
                      <MessageResponse>{text}</MessageResponse>
                    </MessageContent>
                  </Message>
                );
              })
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t border-border/70 bg-secondary/20 p-3 md:p-4">
          <PromptInput
            className="rounded-2xl border border-border bg-card px-2 py-2"
            onSubmit={async ({ text }) => {
              if (!text.trim()) {
                return;
              }

              setStatus("submitted");
              setMessages((prev) => [...prev, makeUserMessage(text)]);

              await new Promise((resolve) => setTimeout(resolve, 550));
              setStatus("streaming");

              await new Promise((resolve) => setTimeout(resolve, 420));
              const reply = simulateEvolutionAnswer(text);
              setMessages((prev) => [...prev, makeAssistantMessage(reply)]);
              setStatus("ready");
            }}
          >
            <PromptInputBody>
              <PromptInputTextarea placeholder="输入目标：例如‘重构资产搜索，并给出回滚策略’" />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputButton disabled variant="ghost">
                /a2a ready
              </PromptInputButton>
              <PromptInputSubmit status={status}>
                <SendHorizonal className="size-4" />
              </PromptInputSubmit>
            </PromptInputFooter>
          </PromptInput>
        </div>
      </section>
    </main>
  );
}
