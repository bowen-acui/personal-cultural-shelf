import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mediaFile = path.join(projectRoot, "data/media.json");
const sourceFont = path.join(projectRoot, "public/fonts/lxgw-wenkai-regular.ttf");
const outputFont = path.join(projectRoot, "public/fonts/lxgw-wenkai-subset.woff2");

// 站内固定文案 + 海报标题。这些字不能指望藏品数据顺带覆盖——
// 「崔」一度只靠某一条笔记撑着，那条笔记一删海报标题就会掉字。
const uiCharset = "完读日期个人评分点击翻回封面翻转查看作品信息书影音豆瓣评分小说·，。：/（）— 0123456789年月日阿崔的精神地图";
const asciiCharset = Array.from({ length: 95 }, (unused, index) => String.fromCharCode(32 + index)).join("");

export function charsetFromMedia(records) {
  const characters = new Set([...uiCharset, ...asciiCharset]);
  for (const record of records) {
    for (const value of [record.title, record.creator, ...(record.categories ?? [])]) {
      for (const character of String(value ?? "")) characters.add(character);
    }
  }
  return [...characters].join("");
}

async function subsetFont() {
  const records = JSON.parse(await readFile(mediaFile, "utf8"));
  const charset = charsetFromMedia(records);
  const workingDirectory = await mkdtemp(path.join(os.tmpdir(), "shelf-subset-"));
  const charsetFile = path.join(workingDirectory, "charset.txt");
  try {
    await writeFile(charsetFile, charset, "utf8");
    execFileSync("pyftsubset", [
      sourceFont,
      `--text-file=${charsetFile}`,
      "--flavor=woff2",
      `--output-file=${outputFont}`,
    ]);
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
  process.stdout.write(`Subset LXGW WenKai to ${[...new Set(charset)].length} glyphs -> ${path.relative(projectRoot, outputFont)}.\n`);
}

// 子集字体（woff2）随仓库发布，源 TTF 有 24MB 故不入库：缺任一前置条件时跳过而不阻断数据构建。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    execFileSync("pyftsubset", ["--help"], { stdio: "ignore" });
  } catch {
    process.stderr.write("pyftsubset not found — skipping font subset (install with: brew install fonttools).\n");
    process.exit(0);
  }
  try {
    await access(sourceFont);
  } catch {
    process.stderr.write(`${path.relative(projectRoot, sourceFont)} not found — skipping font subset.\n`);
    process.stderr.write("Restore it with: git show 3fd8d17:public/fonts/lxgw-wenkai-regular.ttf > public/fonts/lxgw-wenkai-regular.ttf\n");
    process.exit(0);
  }
  await subsetFont();
}
