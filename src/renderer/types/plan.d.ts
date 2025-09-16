export type AgentPlan = {
  steps: string[];
  reasoning: string;
  requiresTools: boolean;
  selectedAgent: string | null;
  currentStep?: number; // Track which step is currently being executed
};

export type TodoItem = {
  id: string;
  text: string;
  completed: boolean;
  order: number;
};
