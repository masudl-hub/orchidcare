// Re-export from canonical source. orchid-agent imports agentTools + functionTools.
// All tool definitions live in toolSchemas.ts — edit there, not here.

import { allAgentToolsOpenAI } from "./toolSchemas.ts";

// orchid-agent expects: const allTools = [...agentTools, ...functionTools];
// We export the full set as both to maintain the import contract.
export const agentTools = allAgentToolsOpenAI;
export const functionTools: typeof allAgentToolsOpenAI = [];
