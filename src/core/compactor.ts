import { StructuredMessage } from '../types/index.js';

export const POST_COMPACT_TOKEN_BUDGET = 50000;
export const POST_COMPACT_MAX_TOKENS_PER_SKILL = 5000;
export const TIME_BASED_MC_CLEARED_MESSAGE = '[Old tool result content cleared]';

export class ContextCompactor {
  
  // 1. Image & Bloat Stripping
  static stripImagesFromMessages(messages: StructuredMessage[]): StructuredMessage[] {
    return messages.map(message => {
      // EchoAI uses string content for images via Markdown or base64 currently.
      // We will strip massive base64 blobs if found.
      if (message.role !== 'user' || typeof message.content !== 'string') return message;
      
      const content = message.content.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, '[image]');

      return {
        ...message,
        content,
      };
    });
  }

  // 2. Snip Compaction
  static snipOldToolResults(messages: StructuredMessage[], maxTokens: number = 60000): StructuredMessage[] {
    let currentTokens = messages.reduce((sum, m) => sum + (m.content ? m.content.length / 4 : 0), 0);
    
    if (currentTokens < maxTokens) {
      return messages;
    }

    return messages.map((msg, index) => {
      if (index > messages.length - 10) return msg;

      if (msg.role === 'tool') {
         if (msg.content && msg.content.length > 2000) {
            return { ...msg, content: TIME_BASED_MC_CLEARED_MESSAGE };
         }
      }
      return msg;
    });
  }

  // 3. Post-Compact Token Budgets & Prompt Caching Injection
  static enforceTurnLevelBudgets(currentTurnTokens: number, budget: number = POST_COMPACT_TOKEN_BUDGET) {
    if (currentTurnTokens > budget) {
       throw new Error(`Turn budget exceeded: ${currentTurnTokens} > ${budget}. Please optimize context.`);
    }
  }

  static injectPromptCacheBreakpoints(messages: StructuredMessage[]): StructuredMessage[] {
     if (messages.length === 0) return messages;
     const newMessages = [...messages];
     
     const sysIdx = newMessages.findIndex(m => m.role === 'system');
     if (sysIdx !== -1) {
         newMessages[sysIdx] = { 
             ...newMessages[sysIdx], 
             // @ts-ignore
             cache_control: { type: "ephemeral" } 
         };
     }

     if (newMessages.length > 3) {
         newMessages[2] = {
             ...newMessages[2],
             // @ts-ignore
             cache_control: { type: "ephemeral" }
         };
     }

     return newMessages;
  }
}

