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
- **Module items** use `canvas_cc` content types, e.g. `WikiPage` + `identifierref` matching a page `identifier`, or `ExternalUrl` + `url`.  
- **Assignments** link to groups with `assignment_group_identifier_ref`.  
- **Files**: each entry needs `file_location` pointing at a path readable when Ruby runs (same machine as the MCP server).

For every attribute supported by the gem (quizzes, question banks, rubrics, etc.), extend `ruby/build_cartridge.rb` following the [canvas_cc README](https://github.com/instructure/canvas_cc).

## License

MIT
