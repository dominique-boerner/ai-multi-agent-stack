import { ICapability, Ticket, DeveloperResponse, DeveloperTaskPayload, ReviewResponse, JsonSchemaProperty, DataType } from '../../types';
import { LLMFactory } from '../../providers/llm.factory';
import { Logger } from '../../utils/logger';

export interface DeveloperSandboxOutput extends DeveloperResponse {
  status: 'SUBMIT_CODE' | 'REQUEST_FILES';
  requestedFiles?: string[];
}

/**
 * Capability responsible for acting as a Software Developer.
 * It reads tickets, fetches necessary files, and generates code alterations.
 */
export class WriteCodeCapability implements ICapability<DeveloperTaskPayload, DeveloperSandboxOutput> {
  name = "write_code";
  description = "Writes code to fulfill a ticket's acceptance criteria.";

  /**
   * Executes the coding phase, potentially looping internally to request file contents
   * before submitting final code implementations.
   *
   * @param payload - The assigned ticket and a closure to fetch file contents block-by-block.
   * @returns A Promise resolving to the newly generated code changes.
   */
  async execute(payload: DeveloperTaskPayload): Promise<DeveloperSandboxOutput> {
    const ticket: Ticket = payload.ticket;
    let fetchedFilesContext = "";
    let attempts = 0;

    while (attempts < 5) {
      attempts++;
      const prompt = [
        `Project Architecture (Repo Map):`,
        payload.repoMapContext,
        fetchedFilesContext ? `\n--- Currently Read Files ---\n${fetchedFilesContext}` : ``,
        ``,
        `Please implement the following ticket:`,
        `ID: ${ticket.id}`,
        `Title: ${ticket.title}`,
        `User Story: ${ticket.userStory}`,
        `Acceptance Criteria:`,
        ...ticket.acceptanceCriteria.map((ac: string) => `- ${ac}`),
        ``,
        `CRITICAL RULES FOR YOU (THE DEVELOPER):`,
        `1. SCOPE PREVENTION: You MUST stick strictly to the Acceptance Criteria. NEVER add extra features, do not randomly refactor code, and do not implement things that belong to future tickets (like Dark Mode, if not asked for).`,
        `2. LAZY MODIFICATION: Only modify the exact lines of code needed. Keep existing code intact if it works.`,
        ``,
        `Previous Review Feedback:`,
        payload.reviewHistory && payload.reviewHistory.length > 0
          ? payload.reviewHistory.map((r: ReviewResponse, i: number) => `Attempt ${i + 1}:\n${r.feedback}`).join('\n\n')
          : "None (First attempt)",
        ``,
        `If you need to read the contents of existing files to understand the project before modifying anything, output status 'REQUEST_FILES' and list them in 'requestedFiles'.`,
        `Do not submit code until you have read the files you need to modify!`,
        `If a file is no longer needed or must be deleted (e.g. for refactoring), add its relative path to the 'deletedFiles' array. ONLY delete files you are confident about. NEVER delete anything inside the '.ai-stack' directory!`,
        `When you are ready, output status 'SUBMIT_CODE' and provide the final 'files' array and/or 'deletedFiles' array.`
      ].join('\n');

      const schema: JsonSchemaProperty = {
        type: DataType.OBJECT,
        properties: {
          status: { type: DataType.STRING, description: "REQUEST_FILES or SUBMIT_CODE" },
          requestedFiles: {
            type: DataType.ARRAY,
            items: { type: DataType.STRING }
          },
          files: {
            type: DataType.ARRAY,
            items: {
              type: DataType.OBJECT,
              properties: {
                path: { type: DataType.STRING },
                content: { type: DataType.STRING }
              },
              required: ['path', 'content']
            }
          },
          deletedFiles: {
            type: DataType.ARRAY,
            items: { type: DataType.STRING }
          }
        },
        required: ['status']
      };

      const response = await LLMFactory.getProvider(payload.systemConfig).generateStructuredOutput<DeveloperSandboxOutput>(
        payload.model,
        payload.agentConfig.systemInstruction || '',
        prompt,
        schema,
        payload.agentConfig.id,
        payload.systemConfig
      );

      if (response.status === 'REQUEST_FILES' && response.requestedFiles && response.requestedFiles.length > 0) {
        Logger.debug('Sandbox', `Agent requesting file contents for: ${response.requestedFiles.join(', ')}`);
        for (const filePath of response.requestedFiles) {
          const content = await payload.fetchFileContent(filePath);
          fetchedFilesContext += `\n--- ${filePath} ---\n\`\`\`\n${content}\n\`\`\`\n`;
        }
        continue;
      }

      return {
        status: 'SUBMIT_CODE',
        files: response.files || [],
        deletedFiles: response.deletedFiles || [],
      };
    }

    return { status: 'SUBMIT_CODE', files: [], deletedFiles: [] };
  }
}
