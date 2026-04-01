import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '../utils/logger';
import { SystemConfig, JsonSchemaProperty } from '../types';
import { sleep } from '../utils/async.utils';
import { saveTrace } from './llm.trace';
import { ILLMProvider } from './llm.factory';

/**
 * ILLMProvider implementation for Anthropic's Claude models.
 * Enforces structured JSON output via Claude's Tool Calling API.
 */
export class AnthropicClaudeProvider implements ILLMProvider {

  /**
   * Recursively maps the agnostic JsonSchemaProperty into Anthropic's tool input schema format.
   */
  private convertSchema(schema: JsonSchemaProperty): any {
    const res: any = { type: schema.type.toLowerCase() };
    if (schema.description) res.description = schema.description;
    if (schema.properties) {
      res.properties = {};
      for (const k of Object.keys(schema.properties)) {
        res.properties[k] = this.convertSchema(schema.properties[k]);
      }
    }
    if (schema.items)    res.items    = this.convertSchema(schema.items);
    if (schema.required) res.required = schema.required;
    if (schema.enum)     res.enum     = schema.enum;
    return res;
  }

  async generateStructuredOutput<T>(
    modelName: string,
    systemInstruction: string,
    prompt: string,
    responseSchema: JsonSchemaProperty,
    agentId: string = 'system',
    systemConfig?: SystemConfig,
  ): Promise<T> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is missing.');
    const anthropic = new Anthropic({ apiKey });

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const response = await anthropic.messages.create({
          model: modelName,
          max_tokens: 8192,
          system: systemInstruction,
          messages: [{ role: 'user', content: prompt }],
          tools: [{
            name: 'submit_response',
            description: 'Submit the structured response for the task.',
            input_schema: this.convertSchema(responseSchema),
          }],
          tool_choice: { type: 'tool', name: 'submit_response' },
        });

        if (response.usage) {
          const { input_tokens, output_tokens } = response.usage;
          Logger.info('Token Metrics', `[${agentId.padEnd(15)}] In: ${input_tokens} | Out: ${output_tokens} | Total: ${input_tokens + output_tokens}`);
        }

        const toolBlock = response.content.find((c: any) => c.type === 'tool_use') as Anthropic.ToolUseBlock;
        if (!toolBlock?.input) throw new Error('Anthropic returned no structured tool output.');

        const resultObj = toolBlock.input;
        saveTrace(systemConfig, agentId, modelName, systemInstruction, prompt, JSON.stringify(resultObj, null, 2));
        return resultObj as T;
      } catch (error: any) {
        attempt++;
        const dump = String(error?.message ?? '') + String(error?.status ?? '') + JSON.stringify(error);
        if (dump.includes('429') || dump.includes('rate_limit')) {
          Logger.warn('AnthropicClaudeProvider', `[${agentId}] Rate limit hit. Retrying in 60s… (${attempt}/${maxRetries})`);
          await sleep(60_000);
        } else if (attempt >= maxRetries) {
          Logger.error('AnthropicClaudeProvider', `[${agentId}] API Error`, error);
          throw error;
        }
      }
    }
    throw new Error('Max retries exceeded');
  }
}
