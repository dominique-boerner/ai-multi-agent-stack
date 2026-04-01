import { ICapability, Ticket, DeveloperResponse, ReviewResponse, ReviewerTaskPayload, JsonSchemaProperty, DataType } from '../../types';
import { LLMFactory } from '../../providers/llm.factory';

/**
 * Capability responsible for acting as a Code Reviewer.
 * It analyzes code proposals against ticket acceptance criteria.
 */
export class ReviewCodeCapability implements ICapability<ReviewerTaskPayload, ReviewResponse> {
  name = "review_code";
  description = "Reviews proposed codebase changes.";

  /**
   * Executes the review process strictly evaluating if the code fulfills the ticket.
   *
   * @param payload - Contains the ticket, the developer's new code, and the codebase context.
   * @returns A Promise resolving to an APPROVE or REJECT verdict with feedback.
   */
  async execute(payload: ReviewerTaskPayload): Promise<ReviewResponse> {
    const ticket: Ticket = payload.ticket;
    const proposal: DeveloperResponse = payload.proposal;

    let proposedFiles = "";
    if (proposal.files && proposal.files.length > 0) {
      for (const f of proposal.files) {
        proposedFiles += `\n--- Proposed File Creation/Edit: ${f.path} ---\n\`\`\`\n${f.content}\n\`\`\`\n`;
      }
    }
    if (proposal.deletedFiles && proposal.deletedFiles.length > 0) {
      for (const f of proposal.deletedFiles) {
        proposedFiles += `\n--- Proposed Deletion: ${f} ---\n`;
      }
    }
    if (!proposedFiles) {
      proposedFiles = "No files were added, modified, or deleted in this proposal.";
    }

    const prompt = [
      `Project Architecture (Repo Map) before changes:`,
      payload.repoMapContext,
      ``,
      `Ticket Context:`,
      `Title: ${ticket.title}`,
      `Acceptance Criteria:`,
      ...ticket.acceptanceCriteria.map((ac: string) => `- ${ac}`),
      ``,
      `CRITICAL RULES FOR YOU (THE REVIEWER):`,
      `1. Be pragmatic! Your primary job is to check if the Acceptance Criteria are fulfilled.`,
      `2. If the Dev added minor extra things (like a CSS class or a small formatting), APPROVE the ticket but mention it in the feedback. Do not reject just for minor scope creep.`,
      `3. ONLY REJECT if an Acceptance Criterion is fundamentally missing, or if the code has a critical bug that breaks compilation/logic.`,
      ``,
      `Proposed Code to review:`,
      proposedFiles,
    ].join('\n');

    const schema: JsonSchemaProperty = {
      type: DataType.OBJECT,
      properties: {
        status: { type: DataType.STRING, description: "Must strictly be APPROVE or REJECT" },
        feedback: { type: DataType.STRING, description: "Detailed feedback on what needs to change." }
      },
      required: ['status', 'feedback']
    };

    return LLMFactory.getProvider(payload.systemConfig).generateStructuredOutput<ReviewResponse>(
      payload.model,
      payload.agentConfig.systemInstruction || '',
      prompt,
      schema,
      payload.agentConfig.id,
      payload.systemConfig
    );
  }
}
