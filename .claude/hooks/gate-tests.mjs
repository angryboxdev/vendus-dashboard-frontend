#!/usr/bin/env node
// Stop hook (frontend).
// Ao tentar encerrar a resposta, roda a suíte de testes completa do repo atual.
// Detecta Jest ou Vitest. Guarda anti-loop incluída.
//
// Repo-aware por natureza: roda os testes deste repositório. Mudanças feitas no
// OUTRO repo na mesma sessão NÃO são cobertas aqui.

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

function detectTestCmd(projectDir) {
  try {
    const pkg = JSON.parse(
      readFileSync(join(projectDir, "package.json"), "utf8"),
    );
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.vitest) return "npx vitest run";
  } catch {
    /* cai no default */
  }
  return "npx jest --silent";
}

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const payload = readStdin();

if (payload.stop_hook_active) {
  process.exit(0);
}

try {
  execSync(detectTestCmd(projectDir), { stdio: "pipe", encoding: "utf8" });
  process.exit(0);
} catch (e) {
  const output = ((e.stdout || "") + (e.stderr || "")).slice(-3000);
  const out = {
    decision: "block",
    reason:
      `A suíte de testes está falhando. Não conclua antes de deixá-la verde.\n` +
      `\n\`\`\`\n${output}\n\`\`\`\n`,
  };
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}
