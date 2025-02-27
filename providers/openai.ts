import { OpenAI } from "openai";
import type { IChatMessage } from "./types";

const client = new OpenAI({
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.BAILIAN_API_KEY,
});

let totalTokens = 0;

export async function chat<T>(messages: IChatMessage[], format?: any) {
  const resp = await client.beta.chat.completions.parse({
    model: "qwen-turbo-1101",
    messages: messages,
    // response_format: format,
    response_format: {
      type: "json_object",
    },
  });

  const msg = resp.choices.at(0)?.message;

  totalTokens += (resp.usage?.total_tokens || 0);

  console.log("Spend total tokens:", totalTokens);
  try {
    const data = JSON.parse(msg!.content!);
    return data as T;
  } catch (error) {
    throw new Error("Parse response failed: " + JSON.stringify(msg));
  }
}
