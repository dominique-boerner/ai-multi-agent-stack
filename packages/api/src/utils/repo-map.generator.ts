import * as path from 'path';

// Load web-tree-sitter dynamically because it's a commonjs module usually
import { createRequire } from 'module';
import { Logger } from './logger';
const require = createRequire(import.meta.url);
const Parser = require('web-tree-sitter');

export class RepoMapGenerator {
  private parser: any = null;
  private languages: Map<string, any> = new Map();

  constructor() {}

  async init(): Promise<void> {
    if (this.parser) return;
    await Parser.init();
    this.parser = new Parser();
  }

  private async getLanguage(extension: string): Promise<any> {
    if (this.languages.has(extension)) {
        return this.languages.get(extension);
    }
    
    let wasmName = '';
    switch (extension) {
        case '.ts': wasmName = 'tree-sitter-typescript.wasm'; break;
        case '.tsx': wasmName = 'tree-sitter-tsx.wasm'; break;
        case '.js': 
        case '.mjs': 
        case '.cjs': 
        case '.jsx': wasmName = 'tree-sitter-javascript.wasm'; break;
        case '.vue': wasmName = 'tree-sitter-vue.wasm'; break;
        case '.py': wasmName = 'tree-sitter-python.wasm'; break;
        case '.go': wasmName = 'tree-sitter-go.wasm'; break;
        case '.java': wasmName = 'tree-sitter-java.wasm'; break;
        case '.cs': wasmName = 'tree-sitter-c_sharp.wasm'; break;
        default: 
            Logger.debug('RepoMap', `AST Not Supported: Unrecognized extension '${extension}'. Using RegExp fallback.`);
            return null;
    }

    try {
        const wasmPath = require.resolve(`tree-sitter-wasms/out/${wasmName}`);
        const lang = await Parser.Language.load(wasmPath);
        this.languages.set(extension, lang);
        Logger.debug('RepoMap', `Supported: Extension '${extension}' using package 'tree-sitter-wasms' (${wasmName})`);
        return lang;
    } catch (e) {
        Logger.warn('RepoMap', `Failed to load tree-sitter language for ${extension}`);
        return null;
    }
  }

  private extractSymbols(node: any, symbols: string[], depth = 0) {
    if (!node) return;
    
    // We only want top-level or immediate class members to avoid huge maps
    if (depth > 2) return;

    // Indentation for the hierarchy list under the filename (4 spaces)
    const INDENT = "    ";

    // Generic symbol extraction across common language ASTs
    const declarationTypes = new Set([
      'class_declaration', 'function_declaration', 'method_definition', 
      'interface_declaration', 'type_alias_declaration', 'class_definition', 
      'function_definition', 'method_declaration', 'type_spec', 'namespace_declaration'
    ]);

    const identifierTypes = new Set([
      'identifier', 'property_identifier', 'type_identifier'
    ]);

    if (declarationTypes.has(node.type)) {
        const nameNode = node.children.find((c: any) => identifierTypes.has(c.type));
        if (nameNode) {
            let symbolType = node.type.split('_')[0]; // "class", "function", "method", "interface", "type", "namespace"
            symbols.push(`${INDENT}${symbolType} ${nameNode.text}`);
        }
    }

    // Traverse children
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        // We only increase depth heavily if we enter a block body, so we can still extract methods from classes
        const nextDepth = ['class_body', 'declaration_list', 'block'].includes(child.type) ? depth + 1 : depth;
        this.extractSymbols(child, symbols, nextDepth);
    }
  }

  public async generateMap(vfs: Map<string, string>): Promise<string> {
    await this.init();
    
    let mapString = "";
    
    for (const [filePath, content] of vfs.entries()) {
      // Ignore inner stack files
      if (filePath.startsWith('.ai-stack/') && !filePath.startsWith('.ai-stack/tickets/')) continue;
      
      // Handle Tickets simply
      if (filePath.startsWith('.ai-stack/tickets/')) {
        const isDone = content.includes('**Status:** DONE');
        const titleMatch = content.match(/^#\s+\[(.*?)]\s+(.*)/m);
        
        mapString += `- ${filePath}\n`;
        if (titleMatch) {
            mapString += `    ${titleMatch[1]}: ${titleMatch[2]} ${isDone ? '(DONE)' : '(OPEN)'}\n`;
        }
        continue;
      }
      
      mapString += `- ${filePath}\n`;
      
      // Handle Markdown structurally via regex (fastest)
      if (filePath.endsWith('.md')) {
        const headings = content.match(/^#{1,3}\s+.+/gm);
        // Indentation for the hierarchy list under the filename (4 spaces)
        const INDENT = "    ";
        if (headings) headings.forEach(h => mapString += `${INDENT}${h}\n`);
        continue;
      }
      
      // Fallback for empty
      if (!content.trim()) continue;

      const ext = path.extname(filePath).toLowerCase();
      const lang = await this.getLanguage(ext);
      
      if (lang) {
          try {
              this.parser.setLanguage(lang);
              const tree = this.parser.parse(content);
              const symbols: string[] = [];
              this.extractSymbols(tree.rootNode, symbols);
              
              if (symbols.length > 0) {
                  mapString += symbols.join('\n') + '\n';
              }
          } catch (e) {
              Logger.warn('RepoMap', `Failed parsing ${filePath}`, e);
          }
      } else {
          // Fallback to old regex for unsupported languages
          const signatures = content.match(/^(?:export\s+)?(?:class|interface|type|function|const|let|var|enum)\s+\w+/gm);
          if (signatures) {
              // Indentation for the hierarchy list under the filename (4 spaces)
              const INDENT = "    ";
              for (const sig of signatures) {
                  mapString += `${INDENT}${sig}\n`;
              }
          }
      }
    }
    
    return mapString;
  }
}
