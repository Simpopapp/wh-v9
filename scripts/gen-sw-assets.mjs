// Fase 5 (projeto 13, PRD §4.5): precache gerado pelo build.
// Roda após `vite build` e escreve dist/client/sw-assets.json com TODOS os
// assets emitidos (chunks de rotas, motores e dependências + arquivos públicos).
// O service worker lê esse manifesto na instalação — o precache nunca diverge
// do artefato publicado (nada de lista manual).
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const CLIENT_DIR = "dist/client";
const EXCLUDE = new Set(["sw.js", "sw-assets.json", "_headers", "_routes.json"]);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(CLIENT_DIR).filter((f) => {
  const rel = relative(CLIENT_DIR, f);
  return !EXCLUDE.has(rel) && !rel.includes(`${sep}_headers`);
});

if (files.length === 0) {
  console.error("gen-sw-assets: dist/client vazio ou ausente — rode `vite build` antes.");
  process.exit(1);
}

const assets = files.map((f) => "/" + relative(CLIENT_DIR, f).split(sep).join("/")).sort();

writeFileSync(join(CLIENT_DIR, "sw-assets.json"), JSON.stringify(assets));

const total = files.reduce((n, f) => n + statSync(f).size, 0);
console.log(
  `gen-sw-assets: ${assets.length} assets no precache (${(total / 1024).toFixed(0)} kB) → dist/client/sw-assets.json`,
);
