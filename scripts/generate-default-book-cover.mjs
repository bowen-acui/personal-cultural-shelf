import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";
import { resolveVaultRoot } from "../lib/build-utils.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backgroundPath = path.join(projectRoot, "assets/default-book-cover-background.webp");
const vaultRoot = resolveVaultRoot();
const coverDirectory = path.join(vaultRoot, "照片/Project：存放项目的必要信息/閱讀書單 Book Tracker/封面");
const bookDirectory = path.join(vaultRoot, "Project：存放项目的必要信息/閱讀書單 Book Tracker/書櫃");

function titleSvg(title, width, height) {
  const characters = Array.from(title.trim());
  if (!characters.length) throw new Error("A book title is required");
  const lineCount = Math.ceil(characters.length / 6);
  const charsPerLine = Math.ceil(characters.length / lineCount);
  const lines = [];
  for (let index = 0; index < characters.length; index += charsPerLine) {
    lines.push(characters.slice(index, index + charsPerLine).join(""));
  }
  const letterSpacing = 4;
  const fontSize = Math.min(112, (width * 0.79 - letterSpacing * (charsPerLine - 1)) / charsPerLine);
  const lineHeight = fontSize * 1.38;
  const firstBaseline = height / 2 - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.34;
  const text = lines.map((line, index) => `<text x="${width / 2}" y="${firstBaseline + index * lineHeight}" text-anchor="middle">${escapeXml(line)}</text>`).join("");
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><g fill="#1a1a1a" font-family="Songti SC, STSong, serif" font-size="${fontSize}" letter-spacing="${letterSpacing}">${text}</g></svg>`);
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function safeFilename(title) {
  return title.trim().replace(/[\\/:*?"<>|]/g, "-");
}

async function createDefaultBookCover(noteArgument) {
  const notePath = path.resolve(vaultRoot, noteArgument);
  const relativeNote = path.relative(bookDirectory, notePath);
  if (!relativeNote || relativeNote.startsWith("..") || path.isAbsolute(relativeNote) || !relativeNote.endsWith(".md")) {
    throw new Error("Pass a Markdown note inside the Obsidian book shelf");
  }
  const markdown = await readFile(notePath, "utf8");
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) throw new Error("Book note must have YAML frontmatter");
  const metadata = Object.fromEntries(frontmatter[1].split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([^\s][^:]*):\s*(.*)$/);
    return match ? [[match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, "")]] : [];
  }));
  const title = metadata.书名?.trim();
  if (!title) throw new Error("Book note is missing 书名");
  if (metadata.封面?.trim()) throw new Error("Book note already has a cover; refusing to replace it");
  const coverName = `${safeFilename(title)}-默认封面.webp`;
  const outputPath = path.join(coverDirectory, coverName);
  const relativeCover = path.relative(vaultRoot, outputPath).split(path.sep).join("/");
  await access(backgroundPath);
  let coverExists = true;
  try {
    await access(outputPath);
  } catch (error) {
    if (error.code === "ENOENT") coverExists = false;
    else throw error;
  }
  const { width, height } = await sharp(backgroundPath).metadata();
  if (!width || !height) throw new Error("Default cover background has invalid dimensions");
  const svg = titleSvg(title, width, height);
  const cover = await sharp(backgroundPath).composite([{ input: svg }]).webp({ quality: 90, effort: 5 }).toBuffer();
  if (coverExists) {
    if (!(await readFile(outputPath)).equals(cover)) throw new Error(`A different cover already exists: ${outputPath}`);
  } else {
    await mkdir(coverDirectory, { recursive: true });
    await writeFile(outputPath, cover);
  }
  const nextFrontmatter = frontmatter[1].match(/^封面:\s*(?:""|'')?\s*$/m)
    ? frontmatter[1].replace(/^封面:\s*(?:""|'')?\s*$/m, `封面: "${relativeCover}"`)
    : `${frontmatter[1]}\n封面: "${relativeCover}"`;
  await writeFile(notePath, markdown.replace(frontmatter[1], nextFrontmatter), "utf8");
  process.stdout.write(`${relativeCover}\nUpdated: ${relativeNote}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const notePath = process.argv[2];
  if (!notePath || process.argv.length !== 3) {
    process.stderr.write("usage: node scripts/generate-default-book-cover.mjs <vault-relative-book-note.md>\n");
    process.exitCode = 2;
  } else createDefaultBookCover(notePath).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
