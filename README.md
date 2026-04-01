# AI Multi-Agent Stack

> ⚠️ This project is not intended for production use. It is a proof-of-concept demonstrating the capabilities of a scalable AI-driven software development stack and my project to learn about the AI-driven software development process.
> 
> You can find information about how it works and what i learned in the designated Markdown files (HOW_IT_WORKS.md, WHAT_I_LEARNED.md) in the root directory.

A highly scalable Multi-Agent System (MAS) built with Node.js and TypeScript. The system leverages Google Gemini models (via the `@google/genai` SDK) to simulate and automate a complete software development lifecycle.

The core feature of this stack is its **configuration-driven architecture**. Agents function as a virtual development team (Product Owner, Developer, Reviewer) and are instantiated dynamically via a central configuration file.

## 🚀 Getting Started

Follow these steps to set up the project locally.

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- `npm` (Node Package Manager)

### 2. Choose your LLM Provider

This Multi-Agent System is provider-agnostic and utilizes a Factory Pattern. You can configure whether the agents are powered by **Google Gemini** or **Anthropic Claude**.

**Option A: Google Gemini (Default)**
1. Go to [Google AI Studio](https://aistudio.google.com/) and sign in.
2. Click **"Create API key"** and copy the generated key.

**Option B: Anthropic Claude**
1. Generate an API Key from the [Anthropic Console](https://console.anthropic.com/).
2. Open the system configuration file (`src/agent-stack.config.ts`).
3. Change the orchestrator block to use `provider: "anthropic"` and specify a model (e.g., `"claude-sonnet-4-6"`).

### 3. Setup the Project

Depending on your environment, install the dependencies and prepare the environment variables:

```bash
# Install dependencies
npm install

# Copy the example environment file
cp .env.example .env
# (On Windows CMD/PowerShell: copy .env.example .env)
```

Open the `.env` file and insert your API key(s) based on your chosen provider:
```env
PORT=3000
GEMINI_API_KEY="your-api-key-here"
# ANTHROPIC_API_KEY="your-api-key-here"
```

### 4. Running the System

Start the development server. We use `tsx` to seamlessly execute the TypeScript ESM environment.

```bash
npm run dev
```

The Orchestrator will boot up and wait for incoming API requests on `http://localhost:3000`.

### 5. Triggering a Workflow

Interaction with the system revolves entirely around its REST API. You can use tools like Postman, or a simple `cURL` command manually.

Open a **new terminal** window and run:

```bash
curl -X POST http://localhost:3000/api/v1/projects/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_prompt": "Create a simple Todo App REST API in Node.js. The app should save, delete, and check off tasks (Title, Status).",
    "additional_context": "Please use TypeScript and clean Error Handling."
  }'
```

*(Note for Windows users: You can simply execute the provided `trigger-workflow.ps1` script via PowerShell. Adjust the variables at the top of the file to change the prompt!)*

### 6. Expanding the AI Team (Custom Capabilities)

The most powerful feature of this stack is its **Configuration-Driven Architecture**. Instead of hardcoding behavior, you can define exactly what an agent can do by writing custom **Capabilities**. 

A Capability is a standard TypeScript object implementing the `Capability` interface with a designated `execute()` function. This enables agents to do far more than just writing code—they could query databases, trigger external APIs, or fetch Jira tickets!

You register your custom capabilities and assign them to your new agents in `src/agent-stack.config.ts`:

```typescript
// 1. Import your custom capabilities
import { writeFrontendCode, securityAuditCapability } from './capabilities';

export const agentConfig: SystemConfig = {
  // ...
  agents: [
    {
      id: "developer_frontend",
      role: "developer",
      // 2. Assign the capabilities to the agent
      capabilities: [writeFrontendCode, securityAuditCapability],
      systemInstruction: "You are a Frontend Master. You build beautiful React apps."
    }
  ]
}
```

The Orchestrator utilizes **Capability Routing**. When the Product Owner writes a ticket labeled with the `{requiredCapability: 'writeFrontendCode'}` flag, the Orchestrator will automatically route this specific task to your newly created `developer_frontend` agent!

### 7. Where is the Output?

The Multi-Agent stack is fully aware of your local environment via a robust **Virtual File System (VFS)**. 

By default, all generated code and intermediate artifacts are saved to the `workspace/` folder inside your project directory. You can customize this target folder globally by changing the `outputDirectory` property in `src/agent-stack.config.ts`.

Once the **Reviewer Agent** successfully approves a ticket written by the **Developer Agent**, the files are automatically generated and saved locally into your configured output folder, maintaining the exact nested folder structure proposed by the LLM.

**Codebase Session Resume:** If you restart the server with `npm run dev`, the Orchestrator will automatically recursively scan your output folder to rebuild its codebase context. You can ignore specific folders (e.g., `node_modules`, `.venv`) from the context window by adding them to the `ignorePaths` array in `agent-stack.config.ts`. This allows you to continuously expand your previously generated applications with subsequent API requests!

### 8. Repository Map, Dashboard & Observability

**Repository Map (`tree-sitter`)**
To grant our AI Agents an optimized, structural overview of the codebase without exhausting context size, the stack generates an Abstract Syntax Tree (AST) based Repository Map dynamically using `tree-sitter`. This context structure is locally cached as `latest.repository-map` within your target folder under `.ai-stack/cache/`.

The following languages are currently supported natively:
- **TypeScript / JavaScript** (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`) 
- **Vue** (`.vue`)
- **Python** (`.py`)
- **Go** (`.go`)
- **Java** (`.java`)
- **C#** (`.cs`)

*(If a language is not supported natively via AST, the stack automatically falls back to a fast RegExp-based text parser.)*

**Live CLI Dashboard & Logging**
When running `npm run dev`, the orchestrator hides raw console noise and instead displays a real-time **Live Dashboard** in your terminal. This UI shows exactly what each Agent in your configuration is currently working on and lists the completion status of all tickets.
To ensure you still have full observability, the system captures all internal operational trace logs and API warnings, streaming them automatically to a timestamped file located under your target folder at `.ai-stack/logs/YYYY-MM-DD..._server.log`.

You can control verbosity via the `logLevel` property in the `agent-stack.config.ts`. The system uses a strict hierarchy:
- `ERROR` & `INFO`: Core operational events and critical failures.
- `WARN`: Includes everything above, plus retry warnings and quota exhaustion alerts.
- `DEBUG`: Includes everything above, plus granular AST map generation stats.
- `TRACE`: Includes everything above, and **additionally saves raw LLM API Prompts and JSON Responses** into `.ai-stack/logs/reasoning/` for deep hallucination debugging.
