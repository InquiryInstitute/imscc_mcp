# imscc-mcp

Repo: **https://github.com/InquiryInstitute/imscc_mcp**

[MCP](https://modelcontextprotocol.io/) server that builds **Canvas Common Cartridge** (`.imscc`) packages using Instructure’s Ruby gem **[canvas_cc](https://github.com/instructure/canvas_cc)**. Cartridges are **Canvas-profile** CC files; many LMSes (including [Populi](https://support.populiweb.com/hc/en-us/articles/223798167)) can import valid Common Cartridge 1.x zip/imscc.

## Prerequisites

- **Node.js** ≥ 18  
- **Ruby** + **Bundler**  
- From this repo root: `bundle install` (installs gems into `vendor/bundle` per `.bundle/config`)

## Setup

```bash
cd ~/GitHub/imscc_mcp
bundle install
npm install
npm run build
```

## Tests

```bash
bundle install
npm install
npm test
```

Runs integration checks on `ruby/build_cartridge.rb`: successful builds produce a ZIP with `imsmanifest.xml`; invalid specs are rejected.

## Run

```bash
node dist/index.js
```

### Cursor / MCP client

Point `command` at `node` and `args` at the absolute path to `dist/index.js` after `npm run build`. No env vars are required.

## Tools

| Tool | Purpose |
|------|--------|
| `imscc_build_cartridge` | Build `.imscc` from structured input (course, pages, modules, assignments, …). |
| `imscc_example_spec` | Minimal JSON example for `imscc_build_cartridge`. |
| `imscc_check_environment` | Check `ruby`, `bundle`, and `canvas_cc` from this repo. |
| `imscc_canvas_cc_reference` | Links to `canvas_cc`, Populi CC import, 1EdTech. |

## Spec notes

- **`output_directory`**: absolute path; created if missing.  
- **`course.title`**: required.  
- **Assignments** — Supported: groups, points, `submission_types` (e.g. `online_text_entry`, `online_upload`), due dates, HTML body. Link a **rubric** with `rubric_identifier` (must match a `rubrics[].identifier`), plus optional `rubric_use_for_grading` / `rubric_hide_score_total`.  
- **Rubrics** — `rubrics[]` with `identifier`, `external_identifier` (defaults to `identifier`), `title`, optional `points_possible`, and `criteria[]` each with `id`, `description`, `points`, and `ratings[]` (`id`, `description`, `points`, `criterion_id` matching the criterion `id`).  
- **Slides / decks** — There is no separate “slides” type. Package **files** (e.g. `.pptx`, `.pdf`) under `files[]` with `identifier`, `file_path` (path inside the course files tree), and `file_location` (absolute path on the machine that runs the build). Optionally add a module item with `content_type` **`Attachment`** and `identifierref` set to the file’s `identifier` (see [canvas_cc](https://github.com/instructure/canvas_cc) module item types).  
- **Module items** — e.g. `WikiPage` + `identifierref` matching a page `identifier`, or `ExternalUrl` + `url`.  
- **Assignments → groups** — `assignment_group_identifier_ref` must match an assignment group `identifier`.

Importer support (Canvas vs Populi vs others) varies; **test imports** on your LMS.

For types not yet mapped in `ruby/build_cartridge.rb` (quizzes, question banks, full LTI, etc.), extend the script using the [canvas_cc README](https://github.com/instructure/canvas_cc).

## License

MIT
