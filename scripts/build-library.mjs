import { createHash } from "node:crypto";
import os from "node:os";
import { access, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coversDirectory = path.join(projectRoot, "public/covers");
const mediaFile = path.join(projectRoot, "data/media.json");

const sources = [
  { type: "book", directory: "Project：存放项目的必要信息/閱讀書單 Book Tracker/書櫃" },
  { type: "film", directory: "Project：存放项目的必要信息/影" },
  { type: "music", directory: "Project：存放项目的必要信息/音" },
];

export function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const metadata = {};
  let listKey = null;
  for (const line of match[1].split(/\r?\n/)) {
    const property = line.match(/^([^\s][^:]*):\s*(.*)$/);
    if (property) {
      const key = property[1].trim();
      const value = property[2].trim().replace(/^['"]|['"]$/g, "");
      listKey = key === "分类" && !value ? key : null;
      if (value) metadata[key] = value;
      if (listKey) metadata[listKey] = [];
      continue;
    }
    const item = listKey ? line.match(/^\s+-\s+(.+)$/) : null;
    if (item) metadata[listKey].push(item[1].trim().replace(/^['"]|['"]$/g, ""));
  }
  return metadata;
}

export function isDisplayableBook(metadata) {
  const completed = /^(已读|读完|完成|读完待整理)$/.test(metadata.状态?.trim() ?? "");
  return Boolean(metadata.封面 && (metadata.完读日期 || completed));
}

export function completedMonth(value) {
  const match = String(value ?? "").trim().match(/^(\d{4})[-/.年](\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}` : "";
}

export function publicRating(value) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 1 && score <= 5 ? score : 0;
}

export function publicDecimalRating(value) {
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 10 ? score : 0;
}

export function isDisplayableMedia(metadata) {
  return Boolean((metadata.名称 || metadata.书名)?.trim() && metadata.封面?.trim());
}

export function resolveVaultRoot(env = process.env, home = os.homedir()) {
  return path.resolve(env.OBSIDIAN_VAULT || path.join(home, "Documents/obsidian/阿崔"));
}

export function validateUniqueRecords(records) {
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.id)) throw new Error(`Duplicate media id: ${record.id}`);
    seen.add(record.id);
  }
  return records;
}

export function sortMediaRecords(records) {
  return records.sort((left, right) => {
    const typeOrder = left.type.localeCompare(right.type);
    if (typeOrder) return typeOrder;
    if (left.type === "book") {
      const ratingOrder = (right.rating ?? 0) - (left.rating ?? 0);
      if (ratingOrder) return ratingOrder;
    }
    if (left.type === "film") {
      const priorityOrder = (left.pinned ?? 99) - (right.pinned ?? 99);
      if (priorityOrder) return priorityOrder;
      const doubanOrder = (right.doubanRating ?? 0) - (left.doubanRating ?? 0);
      if (doubanOrder) return doubanOrder;
    }
    if (left.type === "music") {
      const priorityOrder = (left.pinned ?? 99) - (right.pinned ?? 99);
      if (priorityOrder) return priorityOrder;
    }
    return left.title.localeCompare(right.title, "zh-CN");
  });
}

// 影/音的置顶来自 frontmatter `置顶:`（数字越小越靠前），换偏好改笔记即可，不用改代码。
// 该字段只参与排序，写 JSON 前会被剥掉，不进入公开数据面。
export function pinnedRank(metadata) {
  const raw = String(metadata.置顶 ?? "").trim();
  const rank = Number(raw);
  // 空串要走缺省而不是被 Number("") 悄悄算成 0 —— 那会把没写置顶的笔记顶到最前。
  return raw && Number.isFinite(rank) ? rank : 99;
}

export function orphanCoverNames(names, referenced) {
  return names.filter((name) => /^[a-f0-9]{12}(?:-(?:320|720))?\.(jpg|jpeg|png|webp|avif)$/i.test(name) && !referenced.has(name));
}

function categories(metadata) {
  return Array.isArray(metadata.分类) ? metadata.分类.filter(Boolean) : [];
}

function publicId(filename, type) {
  return `${type}:${path.basename(filename, path.extname(filename))}`;
}

export function toPublicMedia(filename, metadata, publicCover, type, publicCoverLarge = "") {
  const title = (metadata.名称 || metadata.书名 || path.basename(filename, path.extname(filename))).trim();
  const creator = (metadata.创作者 || metadata.作者 || "").trim();
  const month = type === "book" ? completedMonth(metadata.完读日期) : "";
  const rating = type === "book" ? publicRating(metadata.评分) : 0;
  const doubanRating = type === "film" ? publicDecimalRating(metadata.豆瓣评分 || metadata.豆瓣分数) : 0;
  return {
    id: publicId(filename, type),
    type,
    title,
    ...(creator ? { creator } : {}),
    cover: publicCover,
    ...(publicCoverLarge ? { coverLarge: publicCoverLarge } : {}),
    categories: categories(metadata),
    ...(month ? { completedMonth: month } : {}),
    ...(rating ? { rating } : {}),
    ...(doubanRating ? { doubanRating } : {}),
  };
}

export function toPublicBook(filename, metadata, publicCover) {
  return toPublicMedia(filename, metadata, publicCover, "book");
}

function coverDestination(sourcePath, contents) {
  const extension = path.extname(sourcePath).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(extension)) return null;
  const digest = createHash("sha1").update(contents).digest("hex").slice(0, 12);
  return digest;
}

async function copyCover(sourceCover) {
  const resolvedRoot = await realpath(resolveVaultRoot());
  const resolvedCover = await realpath(sourceCover);
  const relativeCover = path.relative(resolvedRoot, resolvedCover);
  if (relativeCover.startsWith("..") || path.isAbsolute(relativeCover)) return null;
  const sourceStat = await stat(resolvedCover);
  if (!sourceStat.isFile()) return null;
  const contents = await readFile(resolvedCover);
  const outputName = coverDestination(resolvedCover, contents);
  if (!outputName) return null;
  const smallPath = path.join(coversDirectory, `${outputName}-320.webp`);
  const largePath = path.join(coversDirectory, `${outputName}-720.webp`);
  // outputName 是内容哈希，同名即同内容：两档产物都在就没有重编码的必要。
  const encoded = await Promise.all([smallPath, largePath].map((file) => access(file).then(() => true, () => false)));
  if (!encoded.every(Boolean)) {
    await sharp(contents)
      .resize({ width: 320, withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toFile(smallPath);
    await sharp(contents)
      .resize({ width: 720, withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 })
      .toFile(largePath);
  }
  return {
    small: `public/covers/${outputName}-320.webp`,
    large: `public/covers/${outputName}-720.webp`,
  };
}

async function buildSource(source) {
  const vaultRoot = resolveVaultRoot();
  const directory = path.join(vaultRoot, source.directory);
  const records = [];
  for (const filename of (await readdir(directory)).filter((name) => name.endsWith(".md"))) {
    const markdown = await readFile(path.join(directory, filename), "utf8");
    const metadata = parseFrontmatter(markdown);
    const displayable = source.type === "book" ? isDisplayableBook(metadata) : isDisplayableMedia(metadata);
    if (!displayable) continue;
    try {
      const covers = await copyCover(path.resolve(vaultRoot, metadata.封面));
      if (covers) records.push({ ...toPublicMedia(filename, metadata, covers.small, source.type, covers.large), pinned: pinnedRank(metadata) });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return records;
}

async function buildLibrary() {
  await mkdir(coversDirectory, { recursive: true });
  await mkdir(path.dirname(mediaFile), { recursive: true });
  const collections = [];
  for (const source of sources) collections.push(...await buildSource(source));
  validateUniqueRecords(collections);
  sortMediaRecords(collections);
  for (const record of collections) delete record.pinned;
  const temporaryFile = `${mediaFile}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(collections, null, 2)}\n`, "utf8");
  await rename(temporaryFile, mediaFile);
  const referenced = new Set(collections.flatMap((item) => [path.basename(item.cover), path.basename(item.coverLarge)]));
  const existingCovers = await readdir(coversDirectory);
  for (const orphan of orphanCoverNames(existingCovers, referenced)) await rm(path.join(coversDirectory, orphan));
  const counts = collections.reduce((result, item) => { result[item.type] = (result[item.type] ?? 0) + 1; return result; }, {});
  process.stdout.write(`Generated ${collections.length} media records (${Object.entries(counts).map(([type, count]) => `${type}=${count}`).join(", ")}).\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await buildLibrary();
