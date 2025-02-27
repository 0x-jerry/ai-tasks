import "dotenv/config";
import * as v from "valibot";
import { toJsonSchema } from "@valibot/to-json-schema";
import { Octokit } from "octokit";
import { getRepoContent, setRepoContent, setRepoInfo } from "../core";
import { ollama as aiClient, type IChatMessage } from "../providers";
import { readFile } from "node:fs/promises";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

interface EvalResult {
  description: string;
  tags: string[];
}

async function getRepoInfo(
  gitUrl: string,
  opt: { owner: string; repo: string }
) {
  console.log(`Getting github readme for: ${gitUrl}`);
  const exists = getRepoContent(gitUrl);

  let mdContent = exists?.readme;

  if (!mdContent) {
    const mdResp = await octokit.rest.repos.getReadme({
      owner: opt.owner,
      repo: opt.repo,
    });

    const base64ToText = (b64: string) => {
      return Buffer.from(b64, "base64").toString("utf-8");
    };

    mdContent = base64ToText(mdResp.data.content);

    setRepoContent(gitUrl, mdContent);
  }

  console.log(`Ollama is thinking for: ${gitUrl}`);

  const genUserMsg = (url: string, content: string) =>
    `请根据以下 GitHub 仓库及其描述：
---
Github URL: ${url}
Github Content:
${content}
`;

  const examples = [
    {
      description:
        "A high-quality, accessible, and performant combobox component for React. It is designed to be composable, with clear CSS selectors allowing for easy styling. The component supports various features such as asynchronous results, filtering and sorting, accessibility (tested with Voice Over and Chrome DevTools), React 18 compatibility, and React Server Components support. Additionally, it provides recommendations on integrating ⌘K with Radix UI's Popover and includes a history section detailing its development journey. The component is built to be server-safe, concurrent mode compatible, and supports React Native alternatives in the future. It also offers guidance on handling hydration mismatches and ensuring unique keys for optimal performance.",
      tags: [
        "React",
        "Combobox",
        "Accessibility",
        "Performance",
        "Composability",
        "Styling",
        "Asynchronous Results",
        "Filtering and Sorting",
        "Radix UI Popover",
        "Hydration Mismatch",
        "Unique Keys",
      ],
    },
    {
      description:
        "RustDesk is a free and open-source remote desktop application that allows users to connect to their devices remotely over the internet. It supports Windows, macOS, Linux, Android, iOS, and Web platforms. The project leverages the Rust programming language for its performance and safety features. Key components include video and audio streaming, screen sharing, file transfer, clipboard synchronization, and input control across different operating systems. The application utilizes a decentralized architecture with RustDesk-server to handle connections, enabling direct peer-to-peer interactions when possible or falling back to relayed connections if necessary.",
      tags: [
        "remote desktop",
        "Rust programming language",
        "open-source",
        "cross-platform",
        "screen sharing",
        "file transfer",
        "clipboard sync",
        "input control",
        "peer-to-peer",
        "decentralized architecture",
        "RustDesk-server",
        "TCP hole punching",
        "relay connections",
      ],
    },
  ];

  const exampleStr = examples
    .map((example, idx) => `示例 ${idx + 1}: ${JSON.stringify(example)}`)
    .join("\n");

  const userMSg = genUserMsg(gitUrl, mdContent);

  const messages: IChatMessage[] = [
    {
      role: "system",
      content: `你是一个数据分类师，你需要根据Github仓库的描述，给其分类，并返回一个标签数组（英文），最多不超过5个，以及一个简短的描述（中文）。用 JSON 格式回复。\n${exampleStr}`,
    },
    {
      role: "user",
      content: userMSg,
    },
  ];
  const format = toJsonSchema(
    v.object({
      description: v.string(),
      tags: v.array(v.string()),
    })
  );

  const data = await aiClient.chat<EvalResult>(messages, format);

  return data;
}

async function startProcess() {


  const repos = JSON.parse(await readFile('./temp/stared.json', {encoding:'utf-8'}));

  const MAX_LENGTH = 10000;
  let currentIndex = 0;

  const restRepos = (repos as any[]).slice(
    currentIndex,
    currentIndex + MAX_LENGTH
  );

  for (const repo of restRepos) {
    const githubUrl = repo.html_url;

    let retries = 3;

    while (retries) {
      try {
        const result = await getRepoInfo(githubUrl, {
          owner: repo.owner.login,
          repo: repo.name,
        });

        currentIndex++;

        console.log(
          `[Done] index: ${currentIndex}, git: ${githubUrl}, result: \n${JSON.stringify(
            result,
            null,
            2
          )}`
        );

        setRepoInfo(githubUrl, result.tags.join(","), result.description);
        break;
      } catch (error) {
        console.log("error:", error);
        retries--;
      }
    }
  }
}

startProcess();
