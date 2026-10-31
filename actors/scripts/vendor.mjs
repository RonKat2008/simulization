// Durable Actors compiles actor code with TS "NodeNext", which rejects the extensionless relative
// imports used by packages/shared and packages/agents. This copies both packages' sources into
// actors/vendor/ with `.js` added to relative specifiers (originals are never modified).
// tsconfig `paths` maps @simulization/* to the vendored copies. Re-run after editing those packages.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const out = join(root, "vendor")
const REL = /((?:from|import\()\s*)(["'])(\.{1,2}\/[^"']+?)\2/g
const withExt = (spec) => (/\.[cm]?[jt]sx?$|\.json$/.test(spec) ? spec : `${spec}.js`)

rmSync(out, { recursive: true, force: true })
for (const pkg of ["shared", "agents"]) {
  const src = join(root, "..", "packages", pkg, "src")
  const dst = join(out, pkg)
  mkdirSync(dst, { recursive: true })
  cpSync(src, dst, { recursive: true })
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (p.endsWith(".ts")) writeFileSync(p, readFileSync(p, "utf8").replace(REL, (_m, pre, q, spec) => `${pre}${q}${withExt(spec)}${q}`))
    }
  }
  walk(dst)
}
console.log("vendored shared + agents into actors/vendor")
