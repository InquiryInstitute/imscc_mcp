import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(__dirname, "..");
const RUBY_SCRIPT = join(REPO_ROOT, "ruby", "build_cartridge.rb");

/**
 * @param {Record<string, unknown>} spec
 * @returns {{ status: number | null, stdout: string, stderr: string }}
 */
export function runBuildCartridge(spec) {
  const result = spawnSync("bundle", ["exec", "ruby", RUBY_SCRIPT], {
    cwd: REPO_ROOT,
    input: JSON.stringify(spec),
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env },
  });
  return {
    status: result.status,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

export function tempOutputDir() {
  return mkdtempSync(join(tmpdir(), "imscc-test-"));
}

export function cleanupDir(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

/** @param {string} imsccPath */
export function assertZipMagic(imsccPath) {
  const buf = readFileSync(imsccPath);
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error(`Not a ZIP file (expected PK header): ${imsccPath}`);
  }
}

/** @param {string} imsccPath */
export function assertManifestInZip(imsccPath) {
  const r = spawnSync("unzip", ["-l", imsccPath], { encoding: "utf-8" });
  if (r.status !== 0) {
    throw new Error(`unzip -l failed: ${r.stderr || r.stdout}`);
  }
  if (!/imsmanifest\.xml/i.test(r.stdout)) {
    throw new Error(`imsmanifest.xml not listed in zip:\n${r.stdout}`);
  }
}
