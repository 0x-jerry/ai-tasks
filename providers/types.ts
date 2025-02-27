export interface IChatMessage {
  role: "system" | "user" | "assistant";
  content: string;

  [key: string]: any;
}
