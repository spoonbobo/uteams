/**
 * Unified MCP Client Wrapper
 * Handles MCP client initialization and tool management for all agents
 * Supports both screenpipe and external MCP servers (Tavily, Playwright)
 */

import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import fs from 'fs';
import path from 'path';

export interface MCPClientConfig {
  enableScreenpipe?: boolean;
  enableTavily?: boolean;
  enablePlaywright?: boolean;
  screenpipeDir?: string;
  screenpipePort?: string | number;
  tavilyApiKey?: string;
  sseUrl?: string;
}

export class MCPClient {
  private client: MultiServerMCPClient;
  private tools: any[] = [];
  private isInitialized = false;
  private config: MCPClientConfig;

  constructor(config: MCPClientConfig = {}) {
    this.config = {
      enableScreenpipe: config.enableScreenpipe ?? true,
      enableTavily: config.enableTavily ?? true,
      enablePlaywright: config.enablePlaywright ?? false,
      screenpipeDir: config.screenpipeDir,
      screenpipePort: config.screenpipePort,
      tavilyApiKey: config.tavilyApiKey ?? process.env.TAVILY_API_KEY,
      sseUrl: config.sseUrl ?? process.env.SCREENPIPE_MCP_SSE_URL,
    };

    const mcpServers: Record<string, any> = {};

    // Configure Screenpipe MCP if enabled
    if (this.config.enableScreenpipe) {
      const uvCommand = process.platform === 'win32' ? 'uv.exe' : 'uv';
      const defaultHome =
        process.platform === 'win32'
          ? process.env.USERPROFILE || process.env.HOME
          : process.env.HOME || process.env.USERPROFILE;
      const defaultDir = defaultHome
        ? path.join(defaultHome, '.screenpipe', 'mcp')
        : '.screenpipe/mcp';
      const dir = this.config.screenpipeDir ?? process.env.SCREENPIPE_MCP_DIR ?? defaultDir;
      const port = String(this.config.screenpipePort ?? process.env.SCREENPIPE_MCP_PORT ?? 3030);

      mcpServers.screenpipe = {
        command: uvCommand,
        args: ['--directory', dir, 'run', 'screenpipe-mcp', '--port', port],
        env: {
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
        },
        transport: 'stdio',
      };

      try {
        const exists = fs.existsSync(dir);
        if (!exists) {
          console.warn(
            `[MCP] Screenpipe MCP directory not found at "${dir}". If not set up, run: screenpipe mcp setup. See docs: https://docs.screenpi.pe/mcp-server`,
          );
        }
        console.log(
          `[MCP] Screenpipe config -> command="${uvCommand}" args=${JSON.stringify(
            mcpServers.screenpipe.args,
          )}`,
        );
      } catch (e) {
        console.warn('[MCP] Could not verify screenpipe directory:', e);
      }

      // Optional SSE fallback for screenpipe
      if (this.config.sseUrl) {
        mcpServers.screenpipe_sse = {
          url: this.config.sseUrl,
          transport: 'sse',
        };
      }
    }

    // Configure Tavily MCP if enabled and API key is available
    if (this.config.enableTavily && this.config.tavilyApiKey?.trim()) {
      const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      mcpServers.tavily = {
        command: npxCommand,
        args: ['-y', 'tavily-mcp@0.1.3'],
        env: { TAVILY_API_KEY: this.config.tavilyApiKey },
        transport: 'stdio',
      };
    } else if (this.config.enableTavily) {
      console.warn('[MCP] TAVILY_API_KEY not set; Tavily MCP will be disabled.');
    }

    // Configure Playwright MCP if enabled
    if (this.config.enablePlaywright) {
      const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      mcpServers.playwright = {
        command: npxCommand,
        args: ['-y', '@playwright/mcp@latest'],
        transport: 'stdio',
      };
    }

    // Log configured servers
    try {
      const serverSummary = Object.entries(mcpServers).map(([name, cfg]) => ({
        name,
        transport: cfg.transport,
        command: cfg.command,
        url: cfg.url,
      }));
      if (serverSummary.length > 0) {
        console.log('🧩 MCP servers configured:', serverSummary);
      }
    } catch (e) {
      console.warn('[MCP] Could not print server summary');
    }

    this.client = new MultiServerMCPClient({ mcpServers });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Get MCP tools
      try {
        this.tools = await this.client.getTools();
        console.log(`🤖 MCP Client initialized with ${this.tools.length} tools`);
        
        // Log tool details for debugging
        try {
          const toolNames = (this.tools || []).map((t: any) => t?.name).filter(Boolean);
          if (toolNames.length > 0) {
            console.log(`[MCP] Tools discovered: ${toolNames.join(', ')}`);
          }
          for (const t of this.tools) {
            const name = (t && (t.name || t.tool || t.id)) || 'unknown';
            const desc = (t && (t.description || t.desc)) || '';
            console.log(
              `[MCP] Tool -> name="${name}" description="${desc.substring(0, 100)}..." hasInvoke=${
                typeof (t as any)?.invoke === 'function'
              }`,
            );
          }
        } catch (e) {
          console.warn('[MCP] Could not log tool details:', e);
        }
      } catch (e) {
        console.error('[MCP] Tools discovery failed; continuing without MCP tools:', e);
        this.tools = [];
      }
      this.isInitialized = true;
    } catch (error) {
      console.error('[MCP] Failed to initialize MCP client:', error);
      throw error;
    }
  }

  async warmup(timeoutMs: number = 30000): Promise<boolean> {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`MCP tools discovery timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    try {
      console.log(`⚙️ Warming up MCP tools (timeout ${timeoutMs}ms)...`);
      const toolsResult: any = await Promise.race([
        this.client.getTools(),
        timeoutPromise,
      ]);
      if (Array.isArray(toolsResult)) {
        this.tools = toolsResult;
      }
      console.log(`🤖 MCP warmup complete; discovered ${this.tools.length} tools`);
      return true;
    } catch (error) {
      console.error('❌ MCP warmup failed or timed out:', error);
      return false;
    }
  }

  async refreshTools(): Promise<void> {
    if (!this.tools.length) {
      try {
        this.tools = await this.client.getTools();
      } catch (e) {
        console.error('[MCP] Failed to refresh tools:', e);
        this.tools = [];
      }
    }
  }

  getTools(): any[] {
    return this.tools;
  }

  async cleanup(): Promise<void> {
    try {
      await this.client.close();
      console.log('🛑 MCP client cleaned up');
    } catch (error) {
      console.error('[MCP] Error cleaning up MCP client:', error);
    }
  }
}

// Convenience factory functions for specific agent configurations
export function createGeneralMCPClient(): MCPClient {
  return new MCPClient({
    enableScreenpipe: false,
    enableTavily: true,
    enablePlaywright: false,
  });
}

export function createResearchMCPClient(): MCPClient {
  return new MCPClient({
    enableScreenpipe: false,
    enableTavily: true,
    enablePlaywright: true,
  });
}
