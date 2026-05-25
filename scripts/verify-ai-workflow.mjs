import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const requiredFiles = [
  "AGENTS.md",
  "docs/architecture.md",
  "docs/coding-style.md",
  "docs/api-spec.md",
  "docs/workflow.md",
  "tasks/task-template.md",
  "tasks/lessons.md",
  ".github/pull_request_template.md",
  ".github/workflows/ci.yml"
];

const requiredPackageScripts = ["lint", "test", "verify", "typecheck", "build:app"];

const textChecks = [
  ["AGENTS.md", "## Coding Rules"],
  ["AGENTS.md", "## Workflow"],
  ["AGENTS.md", "## Git Rules"],
  ["docs/workflow.md", "## Standard Loop"],
  ["docs/workflow.md", "npm.cmd run verify"],
  ["tasks/task-template.md", "## Goal"],
  ["tasks/task-template.md", "## Done When"],
  [".github/workflows/ci.yml", "npm.cmd run verify"]
];

const errors = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    errors.push(`Missing required workflow file: ${file}`);
  }
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
for (const scriptName of requiredPackageScripts) {
  if (!packageJson.scripts?.[scriptName]) {
    errors.push(`Missing package script: ${scriptName}`);
  }
}

for (const [file, needle] of textChecks) {
  if (!existsSync(file)) {
    continue;
  }

  const text = await readFile(file, "utf8");
  if (!text.includes(needle)) {
    errors.push(`Expected "${needle}" in ${file}`);
  }
}

if (errors.length > 0) {
  console.error("AI workflow verification failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("AI workflow verification passed.");
