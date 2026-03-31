export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export type UIMessagePart = {
  type: string;
  text?: string;
  [key: string]: unknown;
};

export type UIMessage = {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  parts: UIMessagePart[];
};

export type FileUIPart = {
  type: "file";
  filename: string;
  mediaType: string;
  url: string;
};

export type SourceDocumentUIPart = {
  type: "source";
  sourceId?: string;
  title?: string;
  url?: string;
};