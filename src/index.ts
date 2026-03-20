#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Project root (parent of dist/ when built, or parent of src/ under tsx). */
const ROOT = join(__dirname, "..");
const RUBY_SCRIPT = join(ROOT, "ruby", "build_cartridge.rb");

function runCartridgeBuild(spec: Record<string, unknown>): { ok: true; text: string } | { ok: false; text: string } {
  const result = spawnSync("bundle", ["exec", "ruby", RUBY_SCRIPT], {
    cwd: ROOT,
    input: JSON.stringify(spec),
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env },
  });
  const stderr = result.stderr?.trim() || "";
  const stdout = result.stdout?.trim() || "";
  if (result.status !== 0) {
    return {
      ok: false,
      text: stderr || stdout || `bundle exec failed with exit ${result.status}`,
    };
  }
  return { ok: true, text: stdout || stderr };
}

const buildCartridgeSchema = z.object({
  output_directory: z.string().describe("Absolute directory where the .imscc file will be written (created if needed)"),
  course: z
    .object({
      title: z.string(),
      identifier: z.string().optional().describe("Stable resource id (Canvas-style i… hash or your id)"),
      course_code: z.string().optional(),
      workflow_state: z.string().optional().describe("e.g. unpublished, active"),
      start_at: z.string().optional(),
      conclude_at: z.string().optional(),
    })
    .describe("Course metadata passed to canvas_cc"),
  pages: z.array(z.record(z.unknown())).optional().describe("Wiki pages: identifier, page_name, body, workflow_state?"),
  rubrics: z
    .array(z.record(z.unknown()))
    .optional()
    .describe(
      "Canvas rubrics: identifier, external_identifier?, title, criteria[].id, criteria[].ratings[]; link from assignments via rubric_identifier"
    ),
  assignment_groups: z.array(z.record(z.unknown())).optional(),
  assignments: z
    .array(z.record(z.unknown()))
    .optional()
    .describe(
      "assignment_group_identifier_ref, optional rubric_identifier + rubric_use_for_grading; submission_types per canvas_cc"
    ),
  discussions: z.array(z.record(z.unknown())).optional(),
  canvas_modules: z.array(z.record(z.unknown())).optional().describe("Modules; module_items use content_type WikiPage|ExternalUrl|…"),
  files: z.array(z.record(z.unknown())).optional().describe("identifier, file_path, file_location (local path to copy)"),
  folders: z.array(z.record(z.unknown())).optional(),
});

const server = new McpServer(
  { name: "imscc-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.registerTool(
  "imscc_build_cartridge",
  {
    description:
      "Build a Canvas Common Cartridge (.imscc) using the Ruby canvas_cc gem. Requires Ruby+Bundler and `bundle install` in the imscc-mcp repo. Output is a Canvas-flavored CC file (often importable into Canvas, Populi, etc.).",
    inputSchema: buildCartridgeSchema,
  },
  async (args: z.infer<typeof buildCartridgeSchema>) => {
    const spec: Record<string, unknown> = {
      output_directory: args.output_directory,
      course: args.course,
    };
    if (args.pages?.length) spec.pages = args.pages;
    if (args.rubrics?.length) spec.rubrics = args.rubrics;
    if (args.assignment_groups?.length) spec.assignment_groups = args.assignment_groups;
    if (args.assignments?.length) spec.assignments = args.assignments;
    if (args.discussions?.length) spec.discussions = args.discussions;
    if (args.canvas_modules?.length) spec.canvas_modules = args.canvas_modules;
    if (args.files?.length) spec.files = args.files;
    if (args.folders?.length) spec.folders = args.folders;

    const out = runCartridgeBuild(spec);
    if (!out.ok) {
      return { content: [{ type: "text" as const, text: out.text }], isError: true };
    }
    return { content: [{ type: "text" as const, text: out.text }] };
  }
);

server.registerTool(
  "imscc_example_spec",
  {
    description: "Returns a minimal JSON example you can adapt for imscc_build_cartridge.",
    inputSchema: z.object({}),
  },
  async () => {
    const example = {
      output_directory: "/tmp/my_cartridge_out",
      course: {
        identifier: "icourse_demo",
        title: "Demo Course",
        course_code: "DEMO101",
        workflow_state: "unpublished",
      },
      pages: [
        {
          identifier: "ipage_welcome",
          page_name: "Welcome",
          body: "<p>Welcome to the course.</p>",
          workflow_state: "unpublished",
        },
      ],
      rubrics: [
        {
          identifier: "irubric_demo",
          external_identifier: "ext_rubric_demo",
          title: "Demo rubric",
          points_possible: 10,
          criteria: [
            {
              id: "crit_quality",
              description: "Quality",
              points: 10,
              ratings: [
                { id: "r_high", description: "Excellent", points: 10, criterion_id: "crit_quality" },
                { id: "r_low", description: "Needs work", points: 0, criterion_id: "crit_quality" },
              ],
            },
          ],
        },
      ],
      assignment_groups: [{ identifier: "iag_hw", title: "Homework", position: 1 }],
      assignments: [
        {
          identifier: "ias_hw1",
          title: "Homework 1",
          body: "<p>Submit your work.</p>",
          points_possible: 10,
          workflow_state: "unpublished",
          grading_type: "points",
          submission_types: ["online_text_entry"],
          assignment_group_identifier_ref: "iag_hw",
          rubric_identifier: "irubric_demo",
          rubric_use_for_grading: true,
        },
      ],
      canvas_modules: [
        {
          identifier: "imod_week1",
          title: "Week 1",
          workflow_state: "unpublished",
          module_items: [
            {
              identifier: "imi_welcome",
              title: "Welcome page",
              content_type: "WikiPage",
              identifierref: "ipage_welcome",
              workflow_state: "unpublished",
            },
            {
              identifier: "imi_github",
              title: "Course repo",
              content_type: "ExternalUrl",
              url: "https://github.com/",
              workflow_state: "unpublished",
            },
          ],
        },
      ],
    };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(example, null, 2) }],
    };
  }
);

server.registerTool(
  "imscc_check_environment",
  {
    description:
      "Verify Ruby, Bundler, and canvas_cc are available (bundle exec) from the imscc-mcp installation directory.",
    inputSchema: z.object({}),
  },
  async () => {
    const ruby = spawnSync("ruby", ["-v"], { encoding: "utf-8" });
    const bundle = spawnSync("bundle", ["-v"], { cwd: ROOT, encoding: "utf-8" });
    const gem = spawnSync("bundle", ["exec", "ruby", "-e", "require 'canvas_cc'; puts CanvasCc::VERSION"], {
      cwd: ROOT,
      encoding: "utf-8",
    });
    const lines = [
      `node ${process.version}`,
      `ruby: ${(ruby.stdout || ruby.stderr || "").trim() || "not found"}`,
      `bundle: ${(bundle.stdout || bundle.stderr || "").trim() || "not found"}`,
      `canvas_cc gem: ${(gem.stdout || "").trim() || (gem.stderr || "").trim() || `error (exit ${gem.status})`}`,
    ];
    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

server.registerTool(
  "imscc_canvas_cc_reference",
  {
    description: "Pointers to upstream canvas_cc documentation and the IMS CC / Canvas relationship.",
    inputSchema: z.object({}),
  },
  async () => {
    const text = [
      "Ruby gem: https://github.com/instructure/canvas_cc",
      "Builds Canvas-profile Common Cartridge (.imscc); see gem README for model attributes (Course, Page, Assignment, CanvasModule, ModuleItem, …).",
      "Populi CC import: https://support.populiweb.com/hc/en-us/articles/223798167",
      "1EdTech Common Cartridge: https://www.1edtech.org/standards/common-cartridge",
    ].join("\n");
    return { content: [{ type: "text" as const, text }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
