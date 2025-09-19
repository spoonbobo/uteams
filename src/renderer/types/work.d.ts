export interface Work {
  id: string;
  createdAt: string; // ISO timestamp
  endedAt?: string; // ISO timestamp, optional for ongoing work
  description: string;
  category: string; // default 'general'
  sessionId?: string; // optional link to chat session
}
