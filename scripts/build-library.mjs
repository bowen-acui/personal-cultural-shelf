import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

import {
  coverDestinationName,
  isDisplayableBook,
  isDisplayableMedia,
  orphanCoverNames,
  parseFrontmatter,
  pinnedRank,
  resolveVaultRoot,
  sortMediaRecords,
  toPublicMedia,
  validateUniqueRecords,
} from "../lib/build-utils.mjs";

// 纯函数都在 lib/build-utils.mjs，测试只 import 那个文件，因此不装 sharp 也能跑。
// 本文件是唯一 import sharp 的地方——不要从这里转出纯函数，否则耦合会悄悄长回来。

const defaultProjectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const explicitOutputRoot = process.env.BUILD_OUTPUT_ROOT?.trim();
const outputRoot = explicitOutputRoot ? path.resolve(explicitOutputRoot) : defaultProjectRoot;
const coversDirectory = path.join(outputRoot, "public/covers");
const mediaFile = path.join(outputRoot, "data/media.json");

const sources = [
  { type: "book", directory: "Project：存放项目的必要信息/閱讀書單 Book Tracker/書櫃" },
  { type: "film", directory: "Project：存放项目的必要信息/影" },
  { type: "music", directory: "Project：存放项目的必要信息/音" },
];

function coverDestination(sourcePath, contents) {
  return coverDestinationName(sourcePath, createHash("sha1").update(contents).digest("hex").slice(0, 12));
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
  if (explicitOutputRoot && (await readdir(outputRoot)).length > 0) {
    throw new Error(`BUILD_OUTPUT_ROOT must be empty: ${outputRoot}`);
  }
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
