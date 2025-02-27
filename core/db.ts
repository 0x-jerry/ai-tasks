import sqlite from "node:sqlite";

export const db = new sqlite.DatabaseSync("./temp/db.sqlite");

db.exec(`
  CREATE TABLE IF NOT EXISTS "repo_content" (
    "url" TEXT PRIMARY KEY NOT NULL,
    "readme" TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS "repo_info" (
    "url" TEXT PRIMARY KEY NOT NULL,
    "tags" TEXT NOT NULL,
    "desc" TEXT NOT NULL
  )
`);

const sqlSetRepoInfo = db.prepare(
  `INSERT OR REPLACE INTO repo_info (url, tags, desc) VALUES (?, ?, ?)`
);

const sqlGetRepoContent = db.prepare(
  `SELECT * FROM repo_content WHERE url = ?`
);

const sqlSaveRepoContent = db.prepare(
  `INSERT OR REPLACE INTO repo_content (url, readme) VALUES (?, ?)`
);

interface TableRepoContent {
  id: number;
  url: string;
  readme: string;
}

export function getRepoContent(url: string) {
  const resp = sqlGetRepoContent.get(url) as TableRepoContent | undefined;

  return resp;
}

export function setRepoContent(url: string, readme: string) {
  const resp = sqlSaveRepoContent.run(url, readme);

  return resp;
}

export function setRepoInfo(url: string, tags: string, desc: string) {
  return sqlSetRepoInfo.run(url, tags, desc);
}
