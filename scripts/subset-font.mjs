import { execFileSync } from "node:child_process";
import { access, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultMediaFile = path.join(projectRoot, "data/media.json");
const defaultSourceFont = path.join(projectRoot, "public/fonts/lxgw-wenkai-regular.ttf");
const defaultOutputFont = path.join(projectRoot, "public/fonts/lxgw-wenkai-subset.woff2");

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

function requiredCodePoints(records) {
  return [...charsetFromMedia(records)].map((character) => character.codePointAt(0));
}

async function readMedia(mediaPath) {
  const records = JSON.parse(await readFile(mediaPath, "utf8"));
  if (!Array.isArray(records)) throw new Error(`${mediaPath} must contain a JSON array`);
  return records;
}

function requireCommand(command) {
  try {
    execFileSync(command, command === "ttx" ? ["-h"] : ["--help"], { stdio: "ignore" });
  } catch {
    throw new Error(`${command} not found — install with: brew install fonttools`);
  }
}

async function extractCmapAsync(fontPath, workingDirectory) {
  const cmapPath = path.join(workingDirectory, "cmap.ttx");
  execFileSync("ttx", ["-q", "-f", "-o", cmapPath, "-t", "cmap", fontPath], { stdio: "pipe" });
  const xml = await readFile(cmapPath, "utf8");
  return new Set([...xml.matchAll(/<map\s+code="0x([0-9a-f]+)"/gi)].map((match) => Number.parseInt(match[1], 16)));
}

function formatCodePoint(codePoint) {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

export async function verifyFont({ fontPath, mediaPath }) {
  await access(fontPath);
  const records = await readMedia(mediaPath);
  const workingDirectory = await mkdtemp(path.join(os.tmpdir(), "shelf-font-cmap-"));
  try {
    const cmap = await extractCmapAsync(fontPath, workingDirectory);
    const missing = requiredCodePoints(records).filter((codePoint) => !cmap.has(codePoint));
    if (missing.length > 0) {
      throw new Error(`WenKai cmap missing ${missing.length} required codepoint(s): ${missing.map(formatCodePoint).join(", ")}`);
    }
    return { glyphs: cmap.size, records: records.length };
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

export async function buildSubset({ sourcePath, mediaPath, outputPath, verify = false }) {
  requireCommand("pyftsubset");
  if (verify) requireCommand("ttx");
  await access(sourcePath);
  const records = await readMedia(mediaPath);
  const workingDirectory = await mkdtemp(path.join(os.tmpdir(), "shelf-subset-"));
  const charsetPath = path.join(workingDirectory, "charset.txt");
  try {
    await writeFile(charsetPath, charsetFromMedia(records), "utf8");
    execFileSync("pyftsubset", [sourcePath, `--text-file=${charsetPath}`, "--flavor=woff2", `--output-file=${outputPath}`], { stdio: "pipe" });
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
  if (verify) await verifyFont({ fontPath: outputPath, mediaPath });
  process.stdout.write(`Subset LXGW WenKai to ${[...new Set(charsetFromMedia(records))].length} glyphs -> ${path.relative(projectRoot, outputPath)}.\n`);
}

function parseCodePoint(value) {
  const match = /^U\+([0-9A-F]{1,6})$/i.exec(value);
  const codePoint = match ? Number.parseInt(match[1], 16) : Number.NaN;
  if (!Number.isInteger(codePoint) || codePoint > 0x10ffff) throw new Error(`invalid codepoint: ${value}`);
  return codePoint;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--verify-only") options.mode = "verify-only";
    else if (argument === "--verify") options.verify = true;
    else if (argument === "--self-test-missing") options.mode = "self-test-missing", options.missing = parseCodePoint(argv[++index]);
    else if (["--source", "--media", "--output", "--font", "--tmp-root"].includes(argument)) options[argument.slice(2)] = argv[++index];
    else throw new Error(`unknown option: ${argument}`);
  }
  return options;
}

async function selfTestMissing({ codePoint, tmpRoot }) {
  if (!tmpRoot) throw new Error("--self-test-missing requires --tmp-root <empty-temp-dir>");
  if ((await readdir(tmpRoot)).length > 0) throw new Error("--tmp-root must be empty");
  requireCommand("pyftsubset");
  requireCommand("ttx");
  await access(defaultOutputFont);
  const mediaPath = path.join(tmpRoot, "media.json");
  const fixtureFont = path.join(tmpRoot, "missing-codepoint.woff2");
  const charsetPath = path.join(tmpRoot, "charset.txt");
  const records = await readMedia(defaultMediaFile);
  const charset = [...charsetFromMedia(records)].filter((character) => character.codePointAt(0) !== codePoint).join("");
  await writeFile(mediaPath, JSON.stringify(records), "utf8");
  await writeFile(charsetPath, charset, "utf8");
  execFileSync("pyftsubset", [defaultOutputFont, `--text-file=${charsetPath}`, "--flavor=woff2", `--output-file=${fixtureFont}`], { stdio: "pipe" });
  try {
    await verifyFont({ fontPath: fixtureFont, mediaPath });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes(formatCodePoint(codePoint))) throw error;
    process.stdout.write(`Self-test rejected the intentionally incomplete font (${formatCodePoint(codePoint)}).\n`);
    return;
  }
  throw new Error(`self-test unexpectedly accepted a font missing ${formatCodePoint(codePoint)}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.mode === "verify-only") {
    if (!options.font || !options.media) throw new Error("--verify-only requires --font <woff2> --media <json>");
    const result = await verifyFont({ fontPath: options.font, mediaPath: options.media });
    process.stdout.write(`Verified ${result.records} records against WOFF2 cmap (${result.glyphs} mapped codepoints).\n`);
  } else if (options.mode === "self-test-missing") {
    await selfTestMissing({ codePoint: options.missing, tmpRoot: options["tmp-root"] });
  } else if (options.source || options.media || options.output || options.verify) {
    if (!options.source || !options.media || !options.output || !options.verify) throw new Error("build mode requires --source <ttf> --media <json> --output <woff2> --verify");
    await buildSubset({ sourcePath: options.source, mediaPath: options.media, outputPath: options.output, verify: true });
  } else {
    try {
      await access(defaultSourceFont);
    } catch {
      process.stderr.write("public/fonts/lxgw-wenkai-regular.ttf not found — skipping font subset.\n");
      process.stderr.write("Restore it with: git show 3fd8d17:public/fonts/lxgw-wenkai-regular.ttf > public/fonts/lxgw-wenkai-regular.ttf\n");
      return;
    }
    await buildSubset({ sourcePath: defaultSourceFont, mediaPath: defaultMediaFile, outputPath: defaultOutputFont });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
