import { GoogleGenAI, Schema as GoogleSchema } from '@google/genai';
import { Logger } from '../utils/logger';
import { SystemConfig, JsonSchemaProperty } from '../types';
import { sleep } from '../utils/async.utils';
import { saveTrace } from './llm.trace';
import { ILLMProvider } from './llm.factory';

/**
 * ILLMProvider implementation for Google's Gemini models.
 * Uses the official '@google/genai' SDK with native structured output (responseSchema).
 */
export class GoogleGeminiProvider implements ILLMProvider {

  /**
   * Recursively converts the agnostic JsonSchemaProperty into Google's native Schema format.
   */
  private convertSchema(schema: JsonSchemaProperty): GoogleSchema {
    const res: any = { type: schema.type.toUpperCase() };
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
    return res as GoogleSchema;
  }

  async generateStructuredOutput<T>(
    modelName: string,
    systemInstruction: string,
    prompt: string,
    responseSchema: JsonSchemaProperty,
    agentId: string = 'system',
    systemConfig?: SystemConfig,
  ): Promise<T> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing.');
    const ai = new GoogleGenAI({ apiKey });

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: this.convertSchema(responseSchema),
          },
        });

        const usage = response.usageMetadata;
        if (usage) {
          Logger.info('Token Metrics', `[${agentId.padEnd(15)}] In: ${usage.promptTokenCount} | Out: ${usage.candidatesTokenCount} | Total: ${usage.totalTokenCount}`);
        }

        const text = response.text ?? '';
        saveTrace(systemConfig, agentId, modelName, systemInstruction, prompt, text);
        return JSON.parse(text) as T;
      } catch (error: any) {
        attempt++;
        const dump = String(error?.message ?? '') + String(error?.status ?? '') + JSON.stringify(error);
        if (dump.includes('429') || dump.includes('RESOURCE_EXHAUSTED') || dump.includes('Quota')) {
          Logger.warn('GoogleGeminiProvider', `[${agentId}] Quota exceeded. Retrying in 60s… (${attempt}/${maxRetries})`);
          await sleep(60_000);
        } else if (attempt >= maxRetries) {
          Logger.error('GoogleGeminiProvider', `[${agentId}] API Error`, error);
          throw error;
        }
      }
    }
    throw new Error('Max retries exceeded');
  }
}
