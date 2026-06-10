#!/usr/bin/env node
// PostToolUse hook (frontend).
// Após editar/criar um .ts/.tsx em src/modules/<modulo>/, roda o lint de
// fronteiras e os testes do módulo. Detecta automaticamente Jest ou Vitest.

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, join } from "node:path";

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

function inThisRepo(filePath, projectDir) {
  if (!filePath) return false;
  const abs = resolve(projectDir, filePath);
  const root = resolve(projectDir);
  return abs === root || abs.startsWith(root + "/");
}

// Descobre o runner de testes a partir das devDependencies.
function detectTestCmd(projectDir, modulePath) {
  try {
    const pkg = JSON.parse(
      readFileSync(join(projectDir, "package.json"), "utf8"),
    );
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.vitest) return `npx vitest run ${modulePath}`;
  } catch {
    /* cai no default */
  }
  return `npx jest ${modulePath} --silent`;
}

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const payload = readStdin();
const ti = payload.tool_input || payload.toolInput || {};
const filePath = ti.file_path || ti.path || ti.filePath || "";

const match = filePath.match(/src\/modules\/([^/]+)\//);
if (!inThisRepo(filePath, projectDir) || !match || !/\.tsx?$/.test(filePath)) {
  process.exit(0);
}
const moduleName = match[1];
const modulePath = `src/modules/${moduleName}`;

function run(label, cmd) {
  try {
    execSync(cmd, { stdio: "pipe", encoding: "utf8" });
    return null;
  } catch (e) {
    const output = (e.stdout || "") + (e.stderr || "");
    return `\n### ${label} falhou\n\n\`\`\`\n${output.slice(-3000)}\n\`\`\`\n`;
  }
}

let problems = "";
problems +=
  run(
    "Lint de fronteiras (dependency-cruiser)",
    `npx depcruise ${modulePath} --config .dependency-cruiser.cjs`,
  ) || "";
problems += run("Testes do módulo", detectTestCmd(projectDir, modulePath)) || "";

if (problems) {
  const out = {
    decision: "block",
    reason:
      `Os checks automáticos do módulo "${moduleName}" falharam após sua ` +
      `alteração. Corrija antes de prosseguir:\n${problems}`,
  };
  process.stdout.write(JSON.stringify(out));
}

process.exit(0);
