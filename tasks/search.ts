import 'dotenv/config'
import { isString } from '@0x-jerry/utils'
import type { FunctionTool, IChatMessage } from '../providers'
import { chatWithTool as chatWithTools } from '../providers/openai'
import { toJsonSchema } from '@valibot/to-json-schema'
import * as v from 'valibot'

const message: IChatMessage[] = [
  {
    role: 'user',
    content: '总结这个页面: https://sspai.com/post/97075'
  }
]

const toolsConfig: FunctionTool[] = [
  {
    async fn(args: { url?: string }) {
      if (!args.url?.startsWith('http')) {
        console.log('Invalid url')

        return 'Invalid url'
      }

      const resp = await fetch(args.url)

      return resp.text()
    },
    define: {
      type: 'function',
      function: {
        name: 'get_page_content',
        description: '获取页面内容',
        parameters: toJsonSchema(
          v.object({
            url: v.string()
          })
        )
      }
    }
  }
]

for await (const element of chatWithTools(message, toolsConfig)) {
  if (isString(element)) {
    process.stdout.write(element)
  } else if (element?.type === 'callingTool') {
    console.log('正在调用工具:', element.name, element.arguments)
  } else if (element?.type === 'toolResult') {
    console.log('工具:', element.name, '调用成功')
  }
}

process.stdout.write('\n')
