import { Logger } from '../utils/logger';
import { SystemConfig, JsonSchemaProperty } from '../types';
import { saveTrace } from './llm.trace';
import { ILLMProvider } from './llm.factory';

/**
 * ILLMProvider implementation for local Ollama models.
 * Uses the native fetch API to communicate with the Ollama REST API.
 */
export class OllamaProvider implements ILLMProvider {
  async generateStructuredOutput<T>(
    modelName: string,
    systemInstruction: string,
    prompt: string,
    responseSchema: JsonSchemaProperty,
    agentId: string = 'system',
    systemConfig?: SystemConfig,
  ): Promise<T> {
    const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user',   content: prompt },
        ],
        format: responseSchema as any,
        stream: false,
        options: { temperature: 0.1 }, // Keep deterministic for structured outputs
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    Logger.info('Token Metrics', [
      `[${agentId.padEnd(15)}]`,
      `In: ${data.prompt_eval_count ?? 0}`,
      `| Out: ${data.eval_count ?? 0}`,
      `| Total: ${(data.prompt_eval_count ?? 0) + (data.eval_count ?? 0)}`,
    ].join(' '));

    const text = data.message?.content ?? '';
    saveTrace(systemConfig, agentId, modelName, systemInstruction, prompt, text);
    return JSON.parse(text) as T;
  }
}
