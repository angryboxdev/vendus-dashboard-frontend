#!/usr/bin/env node
// PreToolUse hook (frontend).
// Antes de editar/criar um arquivo em src/modules/<modulo>/, injeta o README do
// módulo no contexto — para o Claude conhecer as decisões de design sem você pedir.

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

// Repo-aware: só age em arquivos dentro DESTE repositório.
function inThisRepo(filePath, projectDir) {
  if (!filePath) return false;
  const abs = resolve(projectDir, filePath);
  const root = resolve(projectDir);
  return abs === root || abs.startsWith(root + "/");
}

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const payload = readStdin();
const ti = payload.tool_input || payload.toolInput || {};
const filePath = ti.file_path || ti.path || ti.filePath || "";

if (!inThisRepo(filePath, projectDir)) {
  process.exit(0);
}

const match = filePath.match(/src\/modules\/([^/]+)\//);
if (match) {
  const moduleName = match[1];
  const readmePath = join(projectDir, "src", "modules", moduleName, "README.md");
  if (existsSync(readmePath)) {
    const doc = readFileSync(readmePath, "utf8");
    const out = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext:
          `Documentação do módulo "${moduleName}" (leia antes de alterar, ` +
          `atente-se a "Decisões de design"):\n\n${doc}`,
      },
    };
    process.stdout.write(JSON.stringify(out));
  }
}

process.exit(0);
