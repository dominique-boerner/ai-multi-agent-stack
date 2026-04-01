import { Logger, LogLevel } from '../utils/logger';
import { SystemConfig } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Saves a detailed markdown trace of an agent's reasoning process (prompt vs response) to disk.
 * Only triggers when the system LogLevel is set to TRACE.
 *
 * @param systemConfig - Determines the target workspace layout.
 * @param agentId      - ID of the executing agent, used to label the trace file.
 * @param modelName    - The LLM model used (e.g. "claude-sonnet-4-6").
 * @param systemInstruction - The agent's persona/system prompt.
 * @param prompt       - The full task query sent to the model.
 * @param rawResponse  - The raw JSON string returned by the LLM.
 */
export function saveTrace(
  systemConfig: SystemConfig | undefined,
  agentId: string,
  modelName: string,
  systemInstruction: string,
  prompt: string,
  rawResponse: string,
): void {
  if (LogLevel.TRACE > Logger.level) return;

  try {
    const outDir   = systemConfig?.outputDirectory ?? 'workspace';
    const traceDir = path.join(process.cwd(), outDir, '.ai-stack', 'logs', 'reasoning');
    fs.mkdirSync(traceDir, { recursive: true });

    const timestamp  = new Date().toISOString().replace(/[:.]/g, '-');
    const traceFile  = path.join(traceDir, `${timestamp}_${agentId}.md`);
    const traceContent = [
      `# Trace: ${agentId}`,
      `**Model**: ${modelName}`,
      ``,
      `## System Instruction`,
      `\`\`\`text`,
      systemInstruction,
      `\`\`\``,
      ``,
      `## Prompt`,
      `\`\`\`text`,
      prompt,
      `\`\`\``,
      ``,
      `## Response`,
      `\`\`\`json`,
      rawResponse,
      `\`\`\``,
    ].join('\n');

    fs.writeFileSync(traceFile, traceContent, 'utf-8');
  } catch (e) {
    Logger.warn('LLMTrace', `Failed to write trace for ${agentId}`, e);
  }
}
