import { Ollama } from "ollama";

const client = new Ollama();

export async function chat<T>(
  messages: { role: string; content: string }[],
  format?: any
) {
  const resp = await client.chat({
    model: "marco-o1",
    messages: messages,
    format,
  });

  const respMsg = resp.message.content;

  const data = JSON.parse(respMsg);

  return data as T;
}
