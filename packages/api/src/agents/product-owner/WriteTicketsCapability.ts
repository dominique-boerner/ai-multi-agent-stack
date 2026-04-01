import { ICapability, Ticket, PoTaskPayload, JsonSchemaProperty, DataType } from '../../types';
import { LLMFactory } from '../../providers/llm.factory';

export interface PoOutput {
  readmeContent: string;
  requirementsContent: string;
  tickets: Ticket[];
}

/**
 * Capability responsible for acting as a Product Owner.
 * It analyzes user prompts and architectural context to generate structured software tickets.
 */
export class WriteTicketsCapability implements ICapability<PoTaskPayload, PoOutput> {
  name = "write_tickets";
  description = "Translates a user prompt into structured tickets and project documents.";
  
  /**
   * Executes the ticket generation logic.
   * 
   * @param payload - Includes contextual data like user prompt and the current repo map.
   * @returns A Promise resolving to documentation payloads and structured tickets.
   */
  async execute(payload: PoTaskPayload): Promise<PoOutput> {
    const revisionHeader = payload.rejectedBatchContext
      ? [
          `⚠ REVISION RUN — The previous ticket batch was rejected by a human reviewer.`,
          ``,
          payload.rejectedBatchContext,
          ``,
          `Based on the feedback above, rewrite the tickets. You may change titles, merge, split, or reorder tickets as needed.`,
          `---`,
          ``,
        ].join('\n')
      : '';

    const prompt = [
      revisionHeader,
      `Project Architecture (Repo Map):`,
      payload.repoMapContext,
      ``,
      `User Request: ${payload.userPrompt}`,
      payload.additionalContext ? `Additional Context: ${payload.additionalContext}` : null,
      `Based on the existing codebase and the user request, break this down into logical tickets.`,
      `CRITICAL INSTRUCTION: The next available ticket ID is '${payload.nextTicketId}'. You MUST start numbering your tickets from ${payload.nextTicketId} onwards sequentially. NEVER reuse an existing TKT- ID from the Repo Map.`,
      `You MUST also provide a robust 'readmeContent' (for README.md) and 'requirementsContent' (for REQUIREMENTS.md).`,
      `Link or at least reference the new ticket IDs inside the REQUIREMENTS.md.`
    ].filter(Boolean).join('\n');

    const schema: JsonSchemaProperty = {
      type: DataType.OBJECT,
      properties: {
        readmeContent: { type: DataType.STRING, description: "Markdown content for the project README.md" },
        requirementsContent: { type: DataType.STRING, description: "Markdown content for REQUIREMENTS.md" },
        tickets: {
          type: DataType.ARRAY,
          items: {
            type: DataType.OBJECT,
            properties: {
              id: { type: DataType.STRING, description: "A unique ticket identifier like TKT-1" },
              title: { type: DataType.STRING },
              userStory: { type: DataType.STRING, description: "As a [role], I can [feature], so that [reason]" },
              acceptanceCriteria: {
                type: DataType.ARRAY,
                items: { type: DataType.STRING }
              },
              technicalSpecifications: { type: DataType.STRING, description: "Technical hints or tech stack notes" },
              requiredCapability: { type: DataType.STRING, description: "Must be exactly 'write_code'" },
              status: { type: DataType.STRING }
            },
            required: ['id', 'title', 'userStory', 'acceptanceCriteria', 'technicalSpecifications', 'requiredCapability', 'status']
          }
        }
      },
      required: ['readmeContent', 'requirementsContent', 'tickets']
    };

    const output: PoOutput = await LLMFactory.getProvider(payload.systemConfig).generateStructuredOutput<PoOutput>(
      payload.model,
      payload.agentConfig.systemInstruction || '',
      prompt,
      schema,
      payload.agentConfig.id,
      payload.systemConfig
    );
    
    // Status is set by the Orchestrator after batch creation — reset here just in case
    output.tickets = output.tickets.map(t => ({ ...t, status: 'NEEDS_HUMAN_REVIEW' as const }));
    return output;
  }
}
