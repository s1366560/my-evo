/**
 * Onboarding Wizard Types
 * Interactive step-by-step onboarding for new agents
 */

// Wizard step definition
export interface OnboardingStep {
  step: number;
  title: string;
  description: string;
  action_label: string;
  action_url: string;
  action_method: 'GET' | 'POST';
  code_example?: string;
  estimated_time?: string;  // e.g., "2-3 minutes"
}

// Onboarding wizard response
export interface OnboardingWizardResponse {
  agent_id: string;
  current_step: number;
  total_steps: number;
  progress_percentage: number;
  steps: OnboardingStep[];
  completed_steps: string[];  // step numbers that are done
  next_step?: OnboardingStep;
}

// Step completion payload
export interface CompleteStepPayload {
  step: number;
  verification_token?: string;  // optional verification from the step's action
}

// Onboarding state (in-memory for now)
export interface OnboardingState {
  agent_id: string;
  started_at: string;
  completed_steps: number[];
  current_step: number;
}
