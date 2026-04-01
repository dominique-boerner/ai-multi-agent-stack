# 🤖 How It Works: The Multi-Agent Stack

This document describes the complete lifecycle of a feature request within the **AI Multi-Agent Stack**. It illustrates the control flow from the initial API request, over the internal event-driven routing to individual LLM agents, down to the secure persistence of files.

---

## 1. High-Level Architecture & Control Flow

The framework heavily uses **Dependency Injection (DI)**, **Event-Driven Pub/Sub**, and a **Capabilities Routing Strategy**. The control flow dictates that components are strictly configured via a centralized `SystemConfig` (`agent-stack.config.ts`), removing hardcoded logic from the agents themselves.

### ❓ What is the Orchestrator?
**The Orchestrator is entirely deterministic.** It does not use LLMs, it does not "think", and it does not make creative decisions. 
It is a pure Node.js class that listens to events and routes payloads (like a standard microservice router). The *Agents* (Product Owner, Developer, Reviewer) are the ones that actually query the Google Gemini Model.

```mermaid
graph TD
    Client["Client (Terminal/CI)"] -- "POST /api/v1/projects/generate" --> Server["Express API (routes.ts)"]
    
    subgraph Config
        ConfigAgent["agent-stack.config.ts"]
    end
    
    Server -- "Injects Config + VFS" --> Orchestrator["Orchestrator (Deterministic)"]
    ConfigAgent -. "SystemConfig" .-> Server
    
    subgraph Core System
        Orchestrator -- "Listens & Emits" --> EventBus["EventBus (EventEmitter)"]
        Orchestrator -- "Manages Lifecycle" --> SharedState["SharedState (VFS)"]
        Orchestrator -- "Updates Status" --> CliDashboard["Live Dashboard"]
    end
    
    subgraph AgentPool ["Agent Pool (AI Models)"]
        EventBus -- "PROJECT_REQUESTED" --> PO["Product Owner"]
        EventBus -- "TICKET_READY_FOR_DEV" --> DEV["Developer"]
        EventBus -- "CODE_PROPOSED" --> REV["Reviewer"]
    end
```

---

## 2. The Feature Lifecycle (Event-Driven Architecture)

The system does no longer use "hard" synchronous loops (like `while` or `for`). Instead, the Orchestrator subscribes to an `EventBus`. When an idea is submitted to the API, an initial event is fired. From then on, agents do their work asynchronously and trigger the *next* event until the queue is clear.

```mermaid
sequenceDiagram
    participant API as Express Server
    participant ORC as Orchestrator & EventBus
    participant VFS as SharedState (Memory)
    participant PO as Product Owner (Agent)
    participant DEV as Developer (Agent)
    participant REV as Reviewer (Agent)
    participant HDD as Workspace (Disk)

    API->>ORC: 1. emit('PROJECT_REQUESTED')
    
    note over ORC,VFS: Pre-loading existing project
    ORC->>VFS: WorkspaceManager.initializeVfs()
    
    note over ORC,PO: Phase 1: Planning
    ORC->>PO: Trigger WriteTicketsCapability
    PO-->>ORC: Returns JSON (README + Tickets)
    ORC->>HDD: Save README.md & REQUIREMENTS.md
    
    ORC->>ORC: emit('TICKETS_CREATED')
    note right of ORC: Puts generated tickets into a queue.<br/>Triggers first ticket.
    
    loop Sequential Event Flow (Per Ticket)
        ORC->>ORC: emit('TICKET_READY_FOR_DEV')
        note over ORC,REV: Phase 2: Implementation & Review
        
        ORC->>DEV: Trigger WriteCodeCapability
        DEV->>VFS: fetchFileContent (Sandbox Reads)
        DEV-->>ORC: Proposes Code Changes
        ORC->>VFS: updateProposedCode(Proposal)
        
        ORC->>ORC: emit('CODE_PROPOSED')
        ORC->>REV: Trigger ReviewCodeCapability (Includes Diff)
        REV-->>ORC: Status: APPROVE / REJECT
        
        alt is REJECTED
            ORC->>ORC: emit('REVIEW_REJECTED')
            note right of ORC: Increments retry counter.<br/>Then re-emits TICKET_READY_FOR_DEV.
        end
        
        alt is APPROVED
            note over ORC,HDD: Phase 3: Committing
            ORC->>ORC: emit('TICKET_COMPLETED')
            ORC->>VFS: commitToVfs() (Merge into Memory)
            ORC->>HDD: applyCodeChangesToDisk() (Write to Disk)
            note right of ORC: Pops next ticket from queue<br/>and loops back.
        end
    end
    
    ORC-->>ORC: emit('WORKFLOW_FINISHED')
```

---

## 3. Data Capabilities & State Management

Agents do not have raw filesystem access. Any action an agent takes is routed through the `SharedState` context and the `WorkspaceManager`.

### 3.1 VFS (Virtual File System)
Before any agent runs, the existing project in the `outputDirectory` (e.g., `workspace/`) is loaded into `SharedState.globalVfs`. 
This acts as a high-speed memory cache. Agents request data from the VFS rather than pulling raw files off the hard drive, allowing the stack to run purely in memory until a PR is explicitly "Approved".

### 3.2 Structured Output Enforcement
The framework leverages the `generateStructuredOutput` wrapper (powered by `@google/genai` Schema restrictions). Thus, LLMs are forced to output predictable JSON objects rather than free-text markdown strings, largely reducing prompt-hallucinations (e.g. Scope Creep).

**Developer Agent Return Model:**
```json
{
  "status": "SUBMIT_CODE",
  "files": [
    { "path": "src/new-feature.ts", "content": "..." },
    { "path": "src/modified-file.ts", "content": "..." }
  ],
  "deletedFiles": [
    "src/old-unused-file.js"
  ]
}
```

---

## 4. Operational Security Sandboxing

When a ticket is approved and the Orchestrator prepares to map the "Proposed VFS State" to the actual Hard Drive, strict checks are enforced by the `WorkspaceManager`:

1. **Path Normalization:** File creations and deletions are normalized (`path.resolve`). Directory Traversal attacks (e.g., trying to modify `../../etc/passwd`) are hard-blocked because the system enforces `.startsWith(workspaceDir)`.
2. **Metadata Protection:** Any file modifying the strict `.ai-stack` directory is ignored. This ensures the reasoning-logs and ticket-tracking data cannot be corrupted or hallucinated away by the agent itself.

```mermaid
graph LR
    A["Developer Proposal"] --> B{"Reviewer Checked?"}
    B -- "APPROVE" --> C{"Path valid?"}
    B -- "REJECT" --> Z["Event: REVIEW_REJECTED"]
    C -- "Yes" --> D{"Extends .ai-stack?"}
    C -- "No" --> Y["Security Warn (Ignore)"]
    D -- "No" --> E["Execute writeFileSync / unlinkSync"]
    D -- "Yes" --> Y["Security Warn (Ignore)"]
```
