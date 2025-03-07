import { OpenAI } from 'openai'
import type { FunctionTool, IChatMessage } from './types'
import { parseJson } from '@0x-jerry/utils'
import debug from 'debug'

const info = debug('ai-task')

const client = new OpenAI({
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.BAILIAN_API_KEY
})

let totalTokens = 0

export async function chat<T>(messages: IChatMessage[], format?: any) {
  const resp = await client.beta.chat.completions.parse({
    model: 'qwen-turbo-1101',
    messages: messages as any,
    // response_format: format,
    response_format: {
      type: 'json_object'
    }
  })

  const msg = resp.choices.at(0)?.message

  totalTokens += resp.usage?.total_tokens || 0

  console.log('Spend total tokens:', totalTokens)
  try {
    const data = JSON.parse(msg!.content!)
    return data as T
  } catch (error) {
    throw new Error('Parse response failed: ' + JSON.stringify(msg))
  }
}

interface ChatMessageChunk {
  type: 'callingTool' | 'toolResult'
  name?: string
  arguments?: string
  content?: string
  id?: string
}

export async function* chatWithTool(
  _messages: IChatMessage[],
  tools?: FunctionTool[]
): AsyncGenerator<string | ChatMessageChunk | undefined | null> {
  const toolsConfig = tools?.map((item) => item.define)

  const messages =
    _messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[]

  const resp = await client.chat.completions.create({
    model: 'qwen-plus-2025-01-25',
    messages: messages,
    tools: toolsConfig
  })

  const msg = resp.choices.at(0)?.message

  if (msg?.tool_calls?.length) {
    messages.push(msg)

    for await (const chunk of callTools(msg.tool_calls)) {
      yield chunk
      if (chunk.type === 'toolResult') {
        messages.push({
          role: 'tool',
          content: chunk.content!,
          tool_call_id: chunk.id!
        })
      }
    }

    for await (const element of chatWithTool(messages as any, tools)) {
      yield element
    }
  }

  yield msg?.content

  return

  async function* callTools(
    _tools: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]
  ): AsyncGenerator<ChatMessageChunk> {
    for (const tool of _tools.slice(0, 3)) {
      const config = tool.function
      if (!config) {
        continue
      }

      const fn = tools?.find((t) => t.define.function.name === config?.name)

      if (!fn) {
        continue
      }

      const parameters = parseJson(config.arguments || '', {}) as any

      yield {
        type: 'callingTool',
        name: config.name,
        arguments: config.arguments
      }
      const result = await fn.fn(parameters || {})
      yield {
        type: 'toolResult',
        name: config.name,
        content: result,
        id: tool.id
      }
    }
  }
}

export async function* chatWithToolStream(
  _messages: IChatMessage[],
  tools?: FunctionTool[]
): AsyncGenerator<string | ChatMessageChunk | undefined | null> {
  const toolsConfig = tools?.map((item) => item.define)

  const messages =
    _messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[]

  info('start call api')
  const resp = await client.chat.completions.create({
    model: 'qwen-plus-2025-01-25',
    messages: messages,
    tools: toolsConfig,
    stream: true
  })

  const toolCallMsg: OpenAI.Chat.Completions.ChatCompletionMessage = {
    role: 'assistant',
    tool_calls: [],
    refusal: null,
    content: null
  }

  let toolsLength: number | null = null
  for await (const chunk of resp) {
    info('chunk: %o', chunk.choices[0])

    if (toolsLength === null) {
      toolsLength = chunk.choices[0].delta.tool_calls?.length || 0
      info('maybe tool: %s', toolsLength > 0)
    }

    if (toolsLength) {
      const detail = chunk.choices[0].delta

      detail.tool_calls?.forEach((item) => {
        if (!toolCallMsg.tool_calls?.[item.index]) {
          toolCallMsg.tool_calls![item.index] = {
            id: item.id || '',
            function: {
              name: item.function?.name || '',
              arguments: item.function?.arguments || ''
            },
            type: 'function'
          }
        } else {
          toolCallMsg.tool_calls[item.index].function.arguments +=
            item.function?.arguments || ''
        }
      })
    } else {
      yield chunk.choices[0].delta.content
    }
  }

  if (toolsLength) {
    info('tool msg: %o', toolCallMsg)
    messages.push(toolCallMsg)

    for await (const chunk of callTools(toolCallMsg.tool_calls!)) {
      if (chunk.type === 'toolResult') {
        messages.push({
          role: 'tool',
          content: chunk.content!,
          tool_call_id: chunk.id!
        })
      }

      yield chunk
    }

    for await (const chunk of chatWithToolStream(messages as any, tools)) {
      yield chunk
    }
  }

  return

  async function* callTools(
    _tools: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]
  ): AsyncGenerator<ChatMessageChunk> {
    for (const tool of _tools.slice(0, 3)) {
      const config = tool.function
      if (!config) {
        continue
      }

      const fn = tools?.find((t) => t.define.function.name === config?.name)

      if (!fn) {
        continue
      }

      const parameters = parseJson(config.arguments || '', {}) as any

      yield {
        type: 'callingTool',
        name: config.name,
        arguments: config.arguments
      }
      const result = await fn.fn(parameters || {})
      yield {
        type: 'toolResult',
        name: config.name,
        content: result,
        id: tool.id
      }
    }
  }
}
