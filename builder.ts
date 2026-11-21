import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { rolldown } from "rolldown";
import { createMetablock } from "./src/metablock.ts";

// .user.js で終わる名前にすると、スクリプトマネージャーがURLを開いたときにインストール画面を出す
// リリース用ワークフロー（release.yml）もこの名前を参照する
const fileName = "keeb-pd-result-scraper.user.js";
const entry = new URL("./src/scriptbody.ts", import.meta.url);
const outDir = new URL("./out/", import.meta.url);
const outFile = new URL(`./${fileName}`, outDir);

// @version は package.json の version と常に一致させる
async function readVersion(): Promise<string> {
  const pkg: unknown = JSON.parse(
    await readFile(new URL("./package.json", import.meta.url), "utf8"),
  );
  if (
    typeof pkg === "object" &&
    pkg !== null &&
    "version" in pkg &&
    typeof pkg.version === "string"
  ) {
    return pkg.version;
  }
  throw new Error("package.json has no string version");
}

async function bundle(): Promise<string> {
  const build = await rolldown({
    input: entry.pathname,
    platform: "browser",
  });
  try {
    const { output } = await build.generate({ format: "esm" });
    const chunk = output.find((o) => o.type === "chunk");
    if (chunk === undefined) {
      throw new Error("Rolldown produced no chunk");
    }
    return chunk.code;
  } finally {
    await build.close();
  }
}

// oxfmt はstdinを受け付けるため、バンドル結果をパイプで渡して整形する
function format(source: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("oxfmt", ["--stdin-filepath", fileName], {
      stdio: ["pipe", "pipe", "inherit"],
    });
    const chunks: Buffer[] = [];
    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString("utf8"));
      } else {
        reject(new Error(`oxfmt exited with code ${code}`));
      }
    });
    proc.stdin.end(source);
  });
}

const script = `${createMetablock(await readVersion())}\n\n${await bundle()}`;
const formatted = await format(script);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await writeFile(outFile, formatted);
console.log(`Built ${outFile.pathname}`);
