import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createManifest, promoteLibrary } from "../scripts/promote-library.mjs";

async function createLibrary(root, label) {
  await mkdir(path.join(root, "data"), { recursive: true });
  await mkdir(path.join(root, "public/covers"), { recursive: true });
  await mkdir(path.join(root, "public/fonts"), { recursive: true });
  await writeFile(path.join(root, "data/media.json"), JSON.stringify([{ id: `book:${label}` }]), "utf8");
  await writeFile(path.join(root, "public/covers/abcdefabcdef-320.webp"), `${label}-small`, "utf8");
  await writeFile(path.join(root, "public/covers/abcdefabcdef-720.webp"), `${label}-large`, "utf8");
  await writeFile(path.join(root, "public/fonts/lxgw-wenkai-subset.woff2"), `${label}-font`, "utf8");
}

test("manifest includes the generated WenKai font", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "shelf-manifest-"));
  try {
    await createLibrary(root, "manifest");
    const manifest = await createManifest(root);
    assert.equal(manifest.schemaVersion, 2);
    assert.equal(manifest.font.path, "public/fonts/lxgw-wenkai-subset.woff2");
    assert.equal(manifest.covers.length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("promotion replaces data, covers, and font as one receipt-backed unit", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "shelf-promote-"));
  const projectRoot = path.join(root, "project");
  const candidateRoot = path.join(root, "candidate");
  const lockPath = path.join(root, "promote.lock");
  const receiptPath = path.join(root, "receipt.json");
  try {
    await createLibrary(projectRoot, "old");
    await createLibrary(candidateRoot, "new");
    const receipt = await promoteLibrary({ candidate: candidateRoot, projectRoot, lock: lockPath, receipt: receiptPath });
    assert.equal(JSON.parse(await readFile(path.join(projectRoot, "data/media.json"), "utf8"))[0].id, "book:new");
    assert.equal(await readFile(path.join(projectRoot, "public/fonts/lxgw-wenkai-subset.woff2"), "utf8"), "new-font");
    assert.deepEqual(await readdir(path.join(projectRoot, "public/covers")), ["abcdefabcdef-320.webp", "abcdefabcdef-720.webp"]);
    assert.match(receipt.fontSha256, /^[0-9a-f]{64}$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("promotion rolls back all three artifact groups after any boundary failure", async () => {
  const boundaries = ["old-data-backed-up", "old-covers-backed-up", "old-font-backed-up", "candidate-data-promoted", "candidate-covers-promoted", "candidate-font-promoted"];
  for (const boundary of boundaries) {
    const root = await mkdtemp(path.join(os.tmpdir(), "shelf-rollback-"));
    const projectRoot = path.join(root, "project");
    const candidateRoot = path.join(root, "candidate");
    try {
      await createLibrary(projectRoot, "old");
      await createLibrary(candidateRoot, "new");
      await assert.rejects(
        promoteLibrary({
          candidate: candidateRoot,
          projectRoot,
          lock: path.join(root, "promote.lock"),
          receipt: path.join(root, "receipt.json"),
          failAfter: boundary,
        }),
        new RegExp(`injected failure after ${boundary}`),
      );
      assert.equal(JSON.parse(await readFile(path.join(projectRoot, "data/media.json"), "utf8"))[0].id, "book:old");
      assert.equal(await readFile(path.join(projectRoot, "public/fonts/lxgw-wenkai-subset.woff2"), "utf8"), "old-font");
      assert.deepEqual(await readdir(path.join(projectRoot, "public/covers")), ["abcdefabcdef-320.webp", "abcdefabcdef-720.webp"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});
