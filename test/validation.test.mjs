import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  REPO_ROOT,
  runBuildCartridge,
  tempOutputDir,
  cleanupDir,
  assertZipMagic,
  assertManifestInZip,
} from "./helpers.mjs";

const RUBY_SCRIPT = join(REPO_ROOT, "ruby", "build_cartridge.rb");

describe("build_cartridge.rb", () => {
  test("minimal valid spec produces .imscc with imsmanifest", () => {
    const out = tempOutputDir();
    try {
      const spec = {
        output_directory: out,
        course: { identifier: "itest_min", title: "Validation Min", course_code: "VAL001" },
        pages: [
          {
            identifier: "ipage_1",
            page_name: "Start here",
            body: "<p>Hello</p>",
            workflow_state: "unpublished",
          },
        ],
      };
      const { status, stdout, stderr } = runBuildCartridge(spec);
      assert.equal(status, 0, `stderr: ${stderr}\nstdout: ${stdout}`);
      const result = JSON.parse(stdout);
      assert.ok(result.imscc_path, "imscc_path in JSON");
      assert.ok(result.filename?.endsWith(".imscc"), "filename ends with .imscc");
      assert.ok(existsSync(result.imscc_path), "file exists");
      assertZipMagic(result.imscc_path);
      assertManifestInZip(result.imscc_path);
    } finally {
      cleanupDir(out);
    }
  });

  test("full example (modules + assignments) produces valid cartridge", () => {
    const out = tempOutputDir();
    try {
      const spec = {
        output_directory: out,
        course: {
          identifier: "itest_full",
          title: "Validation Full",
          course_code: "VAL002",
          workflow_state: "unpublished",
        },
        pages: [
          {
            identifier: "ipage_welcome",
            page_name: "Welcome",
            body: "<p>Welcome</p>",
            workflow_state: "unpublished",
          },
        ],
        assignment_groups: [{ identifier: "iag_hw", title: "Homework", position: 1 }],
        assignments: [
          {
            identifier: "ias_hw1",
            title: "HW1",
            body: "<p>Do work</p>",
            points_possible: 10,
            workflow_state: "unpublished",
            grading_type: "points",
            submission_types: ["online_text_entry"],
            assignment_group_identifier_ref: "iag_hw",
          },
        ],
        canvas_modules: [
          {
            identifier: "imod_w1",
            title: "Week 1",
            workflow_state: "unpublished",
            module_items: [
              {
                identifier: "imi_p1",
                title: "Welcome",
                content_type: "WikiPage",
                identifierref: "ipage_welcome",
                workflow_state: "unpublished",
              },
              {
                identifier: "imi_ext",
                title: "GitHub",
                content_type: "ExternalUrl",
                url: "https://github.com/InquiryInstitute/imscc_mcp",
                workflow_state: "unpublished",
              },
            ],
          },
        ],
      };
      const { status, stdout, stderr } = runBuildCartridge(spec);
      assert.equal(status, 0, `stderr: ${stderr}\nstdout: ${stdout}`);
      const result = JSON.parse(stdout);
      assert.ok(existsSync(result.imscc_path));
      assertZipMagic(result.imscc_path);
      assertManifestInZip(result.imscc_path);
    } finally {
      cleanupDir(out);
    }
  });

  test("rejects invalid JSON", () => {
    const result = spawnSync("bundle", ["exec", "ruby", RUBY_SCRIPT], {
      cwd: REPO_ROOT,
      input: "{not json",
      encoding: "utf-8",
    });
    assert.notEqual(result.status, 0);
    const combined = `${result.stderr ?? ""}${result.stdout ?? ""}`;
    assert.match(combined, /error|Invalid JSON/i);
  });

  test("rejects missing output_directory", () => {
    const { status, stderr, stdout } = runBuildCartridge({
      course: { title: "X" },
    });
    assert.notEqual(status, 0);
    assert.match(stderr + stdout, /output_directory/i);
  });

  test("rejects missing course.title", () => {
    const out = tempOutputDir();
    try {
      const { status, stderr, stdout } = runBuildCartridge({
        output_directory: out,
        course: {},
      });
      assert.notEqual(status, 0);
      assert.match(stderr + stdout, /title/i);
    } finally {
      cleanupDir(out);
    }
  });
});
