import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { rolldown } from "rolldown";
import { metablock } from "./src/metablock.ts";

const entry = new URL("./src/scriptbody.ts", import.meta.url);
const outDir = new URL("./out/", import.meta.url);
const outFile = new URL("./script.js", outDir);

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
    const proc = spawn("oxfmt", ["--stdin-filepath", "script.js"], {
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

const script = `${metablock}\n\n${await bundle()}`;
const formatted = await format(script);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await writeFile(outFile, formatted);
console.log(`Built ${outFile.pathname}`);
