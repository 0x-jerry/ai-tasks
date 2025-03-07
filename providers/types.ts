import type { Awaitable } from '@0x-jerry/utils'
import type { ChatCompletionTool } from 'openai/resources/chat/index.mjs'

export interface IChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string

  [key: string]: any
}

export interface FunctionTool {
  fn: (args: any) => Awaitable<string>
  define: ChatCompletionTool
}
