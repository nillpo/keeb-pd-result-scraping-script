import * as esbuild from "esbuild";
import { denoPlugins } from "@luca/esbuild-deno-loader";
import { metablock } from "./src/metablock.ts";

const url = new URL("./src/scriptbody.ts", import.meta.url);
await esbuild.initialize({});
const result = await esbuild.build({
  bundle: true,
  outdir: "./out",
  entryPoints: [url.toString()],
  write: false,
  plugins: [...denoPlugins()],
  target: "esnext",
  platform: "browser",
  format: "esm",
});

const script = `${metablock}\n\n${result.outputFiles[0].text}`;
esbuild.stop();
async function isExist(
  path: string,
): Promise<{ isExist: false } | { isExist: true; isDirectory: boolean }> {
  try {
    const stat = await Deno.stat(path);
    return { isExist: true, isDirectory: stat.isDirectory };
  } catch (_) {
    return { isExist: false };
  }
}

const fileCheck = await isExist("./out");
if (fileCheck.isExist && fileCheck.isDirectory) {
  await Deno.remove("./out", { recursive: true });
}
await Deno.mkdir("./out");
const proc = new Deno.Command(Deno.execPath(), {
  args: ["fmt", "-"],
  stdin: "piped",
  stdout: "piped",
  stderr: "null",
}).spawn();

const raw = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(script));
    controller.close();
  },
});
await raw.pipeTo(proc.stdin);
const { stdout } = await proc.output();
const scriptFmt = new TextDecoder().decode(stdout);
await Deno.writeTextFile("./out/script.js", scriptFmt);
