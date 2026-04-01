import { SystemConfig, JsonSchemaProperty } from '../types';
import { AnthropicClaudeProvider } from './anthropic-claude.provider';
import { GoogleGeminiProvider } from './google-gemini.provider';
import { OllamaProvider } from './ollama.provider';

/**
 * Defines the contract every LLM provider must fulfill.
 * Ensures a standardized interface for structured output generation
 * regardless of the underlying model or API.
 */
export interface ILLMProvider {
  /**
   * Generates a structured JSON output conforming to the provided schema.
   *
   * @param modelName         - Model identifier (e.g. "claude-sonnet-4-6").
   * @param systemInstruction - Core system prompt defining the agent's persona.
   * @param prompt            - The specific task context and user request.
   * @param responseSchema    - Agnostic JSON Schema definition for the expected output.
   * @param agentId           - Optional agent identifier used for tracing.
   * @param systemConfig      - Global system configuration.
   */
  generateStructuredOutput<T>(
    modelName: string,
    systemInstruction: string,
    prompt: string,
    responseSchema: JsonSchemaProperty,
    agentId?: string,
    systemConfig?: SystemConfig,
  ): Promise<T>;
}

/**
 * Factory that returns the appropriate ILLMProvider based on the system config.
 * Add new providers here as additional `if` branches.
 */
export class LLMFactory {
  static getProvider(config: SystemConfig): ILLMProvider {
    if (config.orchestrator.provider === 'anthropic') return new AnthropicClaudeProvider();
    if (config.orchestrator.provider === 'ollama')    return new OllamaProvider();
    return new GoogleGeminiProvider(); // Default
  }
}
