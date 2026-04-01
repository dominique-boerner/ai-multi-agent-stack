# Project Vision: Building a Scalable AI Multi-Agent Stack

The ultimate goal of this repository is to construct an autonomous, configuration-driven Multi-Agent System (MAS) that simulates a complete software development lifecycle. Rather than relying on a single monolithic LLM prompt to generate an entire application, the system mimics a professional digital product agency. Specialized agents—acting as Product Owners, Developers, and QA Reviewers—collaborate asynchronously to translate vague user requirements into polished, peer-reviewed code. 

By designing a decoupled architecture based on "Capability Routing," the system can be scaled effortlessly to include specialized agents (e.g., Database Architects or Security Experts) using a strict, structured configuration file. This project explores the frontiers of AI coding loops, resilient error handling, and token-efficient state synchronization to build a system that can continuously evolve and expand existing codebases without manual developer intervention.

---

# Key Learnings & Engineering Strategies

During the architectural design and continuous refinement of this system, we encountered numerous challenges inherent to stateful LLM operations. The following points outline our core technical takeaways and best practices.

## 1. Context Optimization: Repo Maps over Raw Virtual File Systems
When working with growing applications, blindless injection of an entire project's source code into the LLM's prompt window leads to catastrophic consequences: skyrocketing API costs, heavy processing latency, and severe "lost in the middle" hallucination issues. 
**The Solution:** Instead of passing raw data, we generate an Abstract Syntax Tree (AST) using tools like `tree-sitter`. We provide the LLM with a highly compressed "Repository Map"—a structural index containing file paths, class definitions, and function signatures. This reduces the context footprint drastically (e.g., from 50,000 to 1,500 tokens) while preserving the LLM's absolute spatial awareness of the project architecture.

## 2. Agentic State-Machine Sandboxing
Language models are eager to please and tend to aggressively attempt to write entire feature sets in a single response, even if they lack the required context. 
**The Solution:** We force "Developer" agents into a strict, programmatic state-machine. By default, agents are not allowed to submit final code immediately. Instead, they must parse requirements and output a `REQUEST_FILES` state, actively selecting the exact files they need to read from the Repository Map. The Orchestrator intercepts this, fetches the requested files, and feeds them back into the loop until the agent explicitly transitions to a `SUBMIT_CODE` state. This tightly controlled sequence simulates intelligent tool calling and drastically improves the precision of the generated code.

## 3. Strict JSON Schema Validation
Unstructured text is the enemy of automated multi-agent communication. Models frequently include conversational fluff (e.g., "Here is the code you asked for...") which breaks standard JSON parsing and halts automated pipelines.
**The Solution:** We must rely completely on stringent API-level JSON Schemas (`responseSchema` in the Google Gen AI API). Whether a Product Owner generates a ticket or a Reviewer responds with an `APPROVE` or `REJECT` flag, enforcing strict semantic typing forces the LLM to skip hallucinations and output pure, deterministically parseable JSON payloads.

## 4. Token Economics and Workflow Decoupling
Operating a Multi-Agent loop at high frequency forces a strict separation of concerns regarding token budgeting.
- **Input Tokens (Context):** These are comparatively fast and cheap. Therefore, sending the full Repo Map and historical review context on every loop iteration is an economically sound strategy to maximize output quality.
- **Output Tokens (Generation):** Output generation is computationally expensive, time-consuming, and prone to rate limits. 
**The Solution:** We decoupled tasks intentionally so that agents do not repeatedly output the same information. For example, instead of an agent continuously re-writing an entire `README.md` while tweaking a single function in `App.js`, we distribute roles cleanly. We keep output payloads as small and focused as possible, focusing exclusively on the specific differential changes required to complete the ticket.

## 5. Persisting Inter-Agent State via a "Local Jira"
A multi-agent orchestrated process will invariably fail over time. APIs will timeout, rate limits will trigger, and orchestration faults will occur. If the entire context only lives inside the Node.js memory (`SharedState`), a single crash resets hours of agent collaboration.
**The Solution:** We adopted an asynchronous, event-driven mechanism where human-readable Markdown acts as the ultimate source of truth. The Product Owner outputs physical "Tickets" to the file system. State and history are deeply serialized to disk in standard formats. This ensures that the system is perfectly resumable, observable, and debuggable in real-time. If the server crashes during code review, restarting it automatically parses the file system and injects the unresolved tickets seamlessly back into the Orchestrator loop.

## 6. Precise Prompt Engineering is Non-Negotiable
Unlike traditional software components, AI models do not execute predictable, deterministic algorithms; instead, they probabilistically synthesize information based on the input context they receive. 
**The Solution:** Proper prompt engineering is an absolute must-have. You cannot just vaguely describe an objective and expect stable, repeatable outcomes across multiple agent runs. Every single piece of additional context, every explicitly prohibited action, and the specific structural layout of your prompt greatly shapes the final result. The more obsessively specific and well-structured the instructions (and the context bounds) are, the higher the fidelity of the generated output.

---

*P.S. Debugging AI issues is an entirely different beast compared to traditional software bugs—welcome to reading thousands of lines of LLM reasoning traces to figure out why an agent suddenly decided to delete your main function! 😉*
