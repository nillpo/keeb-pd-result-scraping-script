import { bundle } from "./deps.ts";
import { metablock } from "./src/metablock.ts";
const url = new URL("./src/scriptbody.ts", import.meta.url);

const bundled = await bundle(url);
const script = `${metablock}\n\n${bundled.code}`;

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

await Deno.writeTextFile("./out/script.js", script);
