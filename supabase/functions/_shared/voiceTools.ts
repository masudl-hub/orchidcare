// Re-export from canonical source. call-session and dev-call-proxy import voiceToolDeclarations.
// All tool definitions live in toolSchemas.ts — edit there, not here.

import { voiceToolsGemini } from "./toolSchemas.ts";

export const voiceToolDeclarations = voiceToolsGemini;
