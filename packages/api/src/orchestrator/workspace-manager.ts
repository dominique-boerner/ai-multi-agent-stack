import * as fs from 'fs';
import * as path from 'path';
import { SystemConfig, Ticket, DeveloperResponse } from '../types';
import { SharedState } from './shared-state';
import { Logger } from '../utils/logger';

export class WorkspaceManager {
  /** Resolved once at construction — the single source of truth for the workspace path. */
  private readonly workspaceDir: string;

  constructor(private config: SystemConfig) {
    // WORKSPACE_DIR env var lets the monorepo API package resolve the root workspace
    // regardless of which directory the process was started from.
    this.workspaceDir = process.env.WORKSPACE_DIR
      ? path.resolve(process.cwd(), process.env.WORKSPACE_DIR)
      : path.join(process.cwd(), config.outputDirectory ?? 'workspace');
    fs.mkdirSync(this.workspaceDir, { recursive: true });
  }

  public initializeVfs(state: SharedState): void {
    const files = this.loadWorkspaceFiles();
    for (const [key, val] of files.entries()) {
      state.globalVfs.set(key, val);
    }
    Logger.info('WorkspaceManager', `Restored ${files.size} existing source files from workspace into Memory.`);

    const restored = this.restoreTicketsFromDisk(state);
    if (restored > 0) {
      Logger.info('WorkspaceManager', `Restored ${restored} tickets from disk into SharedState.`);
    }
  }

  /**
   * Scans workspace/.ai-stack/tickets/ for all TKT-*.md files,
   * parses them back into Ticket objects, and restores them into SharedState.
   * This ensures tickets survive server restarts.
   */
  public restoreTicketsFromDisk(state: SharedState): number {
    const ticketsDir = path.join(this.workspaceDir, '.ai-stack', 'tickets');
    if (!fs.existsSync(ticketsDir)) return 0;

    let count = 0;
    const files = fs.readdirSync(ticketsDir).filter(f => /^TKT-\d+\.md$/.test(f));

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(ticketsDir, file), 'utf-8');
        const ticket = this.parseTicketMarkdown(raw);
        if (ticket) {
          // Only add if not already in state (active workflow may have already added it)
          if (!state.getTicket(ticket.id)) {
            state.addTicket(ticket);
            count++;
          }
        }
      } catch (e: any) {
        Logger.warn('WorkspaceManager', `Could not parse ticket file ${file}: ${e.message}`);
      }
    }
    return count;
  }

  /**
   * Parses a ticket markdown string back into a Ticket object.
   * Format is defined by writeTicketToDisk().
   */
  private parseTicketMarkdown(md: string): Ticket | null {
    const lines = md.split('\n');

    // Line 0: # [TKT-N] Title
    const headerMatch = lines[0]?.match(/^#\s+\[(.+?)\]\s+(.+)$/);
    if (!headerMatch) return null;
    const id    = headerMatch[1].trim();
    const title = headerMatch[2].trim();

    // Metadata lines (2–4): **Status:**, **Capability:**, **Batch:**
    const statusMatch = lines[1]?.match(/^\*\*Status:\*\*\s+(.+)$/);
    const status = (statusMatch?.[1]?.trim() ?? 'OPEN') as Ticket['status'];

    const capMatch = lines[2]?.match(/^\*\*Capability:\*\*\s+(.+)$/);
    const requiredCapability = capMatch?.[1]?.trim();

    const batchMatch = lines[3]?.match(/^\*\*Batch:\*\*\s+(.+)$/);
    const batchId = batchMatch?.[1]?.trim() ?? 'restored';

    // Extract sections by looking for ## headings
    const section = (heading: string): string => {
      const startIdx = lines.findIndex(l => l.trim() === `## ${heading}`);
      if (startIdx === -1) return '';
      const nextHeading = lines.findIndex((l, i) => i > startIdx && l.startsWith('## '));
      const sectionLines = lines.slice(startIdx + 1, nextHeading === -1 ? undefined : nextHeading);
      return sectionLines.join('\n').trim();
    };

    const userStory               = section('User Story');
    const technicalSpecifications = section('Technical Specifications');

    // Acceptance criteria: lines starting with "- [ ] " or "- [x] "
    const acSection = section('Acceptance Criteria');
    const acceptanceCriteria = acSection
      .split('\n')
      .filter(l => l.match(/^-\s+\[.\]\s+/))
      .map(l => l.replace(/^-\s+\[.\]\s+/, '').trim())
      .filter(Boolean);

    return { id, title, status, requiredCapability, userStory, acceptanceCriteria, technicalSpecifications, batchId };
  }

  public writeTicketToDisk(ticket: Ticket): string {
    const md = [
      `# [${ticket.id}] ${ticket.title}`,
      `**Status:** ${ticket.status}`,
      `**Capability:** ${ticket.requiredCapability ?? ''}`,
      `**Batch:** ${ticket.batchId ?? 'unknown'}`,
      ``,
      `## User Story`,
      ticket.userStory,
      ``,
      `## Acceptance Criteria`,
      ...ticket.acceptanceCriteria.map((ac: string) => `- [ ] ${ac}`),
      ``,
      `## Technical Specifications`,
      ticket.technicalSpecifications,
    ].join('\n') + '\n';

    const filePath = path.join(this.workspaceDir, '.ai-stack', 'tickets', `${ticket.id}.md`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, md, 'utf-8');
    return md; // Return the content so the caller can place it in the VFS
  }

  public fetchFileContent(relativePath: string): string {
    const fullPath = path.join(this.workspaceDir, relativePath);
    return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : '';
  }

  public applyCodeChangesToDisk(proposal: DeveloperResponse): void {
    // Write or overwrite files
    for (const file of proposal.files) {
      const absolutePath = path.resolve(this.workspaceDir, file.path);
      if (!absolutePath.startsWith(path.resolve(this.workspaceDir))) {
        Logger.warn('WorkspaceManager', `Blocked path traversal attempt for file generation: ${file.path}`);
        continue;
      }
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, file.content, 'utf-8');
    }

    // Delete files
    for (const relativePath of proposal.deletedFiles ?? []) {
      const absolutePath = path.resolve(this.workspaceDir, relativePath);
      if (!absolutePath.startsWith(path.resolve(this.workspaceDir))) {
        Logger.warn('WorkspaceManager', `Blocked path traversal attempt for deletion: ${relativePath}`);
        continue;
      }
      if (absolutePath.includes('.ai-stack')) {
        Logger.warn('WorkspaceManager', `Blocked attempt to delete internal .ai-stack file: ${relativePath}`);
        continue;
      }
      if (fs.existsSync(absolutePath)) {
        try {
          fs.unlinkSync(absolutePath);
          Logger.info('WorkspaceManager', `Deleted file: ${relativePath}`);
        } catch (e: any) {
          Logger.error('WorkspaceManager', `Failed to delete file ${relativePath}: ${e.message}`);
        }
      }
    }
  }

  public loadWorkspaceFiles(): Map<string, string> {
    const vfs = new Map<string, string>();
    if (!fs.existsSync(this.workspaceDir)) return vfs;

    const ignoredFolders     = this.config.ignorePaths ?? [];
    const ignoredExtensions  = ['.ico', '.png', '.jpg', '.jpeg', '.svg', '.bin', '.exe', '.pdf', '.zip'];
    const ignoredFiles       = new Set(['.env', 'package-lock.json']);

    const readDirRecursive = (dir: string) => {
      for (const file of fs.readdirSync(dir)) {
        const fullPath     = path.join(dir, file);
        const relativePath = path.relative(this.workspaceDir, fullPath).replace(/\\/g, '/');

        const isIgnored = ignoredFolders.some(rule =>
          rule.includes('/') 
            ? relativePath === rule || relativePath.startsWith(rule + '/')
            : relativePath.split('/').includes(rule)
        );
        if (isIgnored) continue;

        if (fs.statSync(fullPath).isDirectory()) {
          readDirRecursive(fullPath);
        } else if (!ignoredExtensions.includes(path.extname(file).toLowerCase()) && !ignoredFiles.has(file)) {
          vfs.set(relativePath, fs.readFileSync(fullPath, 'utf-8'));
        }
      }
    };

    readDirRecursive(this.workspaceDir);
    return vfs;
  }
}
