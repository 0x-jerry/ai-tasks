import "dotenv/config";
import { writeFile } from "fs/promises";

import { Octokit } from "octokit";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const started: any[] = [];

let currentPage = 1;

while (true) {
  const resp = await octokit.request("GET /users/{username}/starred", {
    username: "0x-jerry",
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
    per_page: 100,
    page: currentPage,
  });

  console.log("Fetched length:", resp.data.length);

  started.push(...resp.data);

  currentPage++;

  if (resp.data.length < 100) {
    break;
  }
}

console.log("[Done]");

await writeFile("./temp/stared.json", JSON.stringify(started, null, 2));
