import { SystemConfig } from './types';
import { CapabilityRegistry } from './agents';

export const agentConfig: SystemConfig = {
  orchestrator: {
    // --- Google Gemini (Default) ---
    // provider: "google",
    // model: "gemini-3-flash-preview", // Use "gemini-2.5-flash" or "gemini-2.5-pro" or "gemini-3-flash-preview"

    // --- Anthropic Claude ---
    // provider: "anthropic",
    // model: "claude-sonnet-4-6",

    // --- Local Ollama ---
    provider: "ollama",
    model: "gemma4",

    strategy: "capability_routing",
    maxReviewRetries: 3,
  },
  outputDirectory: "workspace",
  logLevel: "INFO",
  ignorePaths: [
    ".idea",
    "node_modules",
    ".eslintrc.json",
    ".gitignore",
    ".prettierrc",
  ],
  agents: [
    {
      id: "po_main",
      role: "product_owner",
      capabilities: [CapabilityRegistry.writeTickets],
      systemInstruction: "You are a Senior Product Owner. Your job is to translate user ideas into structured tickets.\nYou strictly return JSON containing user stories, acceptance criteria, technical specifications, and a requiredCapability for each ticket.\nThe requiredCapability MUST be exactly 'write_code'."
    },
    {
      id: "developer_1",
      role: "developer",
      capabilities: [CapabilityRegistry.writeCode],
      systemInstruction: "You are a Senior Developer. You write clean, testable code. Follow common best practices.\nYou return structured JSON containing an array of 'files', each with a 'path' (relative file path e.g. pom.xml or src/main/java/com/example/App.java) and 'content' (the raw code)."
    },
    {
      id: "reviewer_senior",
      role: "reviewer",
      capabilities: [CapabilityRegistry.reviewCode],
      systemInstruction: "You are a strict Senior Code Reviewer.\nYour job is to review the proposed code changes against the acceptance criteria of a ticket.\nYou strictly return JSON containing your 'status' (either 'APPROVE' or 'REJECT') and detailed 'feedback'."
    }
  ]
};
