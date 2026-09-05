# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
node convert.js
```

`npm run dev` starts the Vite React UI. `npm run build` creates the production frontend bundle; `npm run lint` currently runs the same build-level validation because no separate linter is configured. `node convert.js` expects `input.zip` in repository root and produces `meg-bedrock.zip`. It launches Chromium through Puppeteer, so local runs need a working Chromium download and system dependencies supported by Puppeteer.

Vercel deploys the React static bundle and `api/` serverless functions. Copy `.env.example` values into server-only Vercel environment variables: `BLOBMEG_READ_WRITE_TOKEN`, `BLOBMEG_HOSTNAME`, `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_WORKFLOW`, and `GITHUB_BRANCH`. Browser uploads go to temporary Vercel Blob storage, then `/api/convert` dispatches GitHub Actions with the Blob URL. `/api/status` polls the run and `/api/download` proxies the short-lived output artifact. `vercel.json` gives API routes a 60-second ceiling. Keep deployment private until authentication and rate limiting are added.

No automated tests exist; `npm test` is a non-failing placeholder.

## Architecture

This is a Node.js CommonJS CLI plus a Blockbench browser plugin.

- [convert.js](convert.js) is the end-to-end batch pipeline. It extracts `input.zip` into `workspace/extracted`, recursively locates `.bbmodel` files, copies them into a flat staging directory with collision-safe names, and retains each file's original folder/name mapping. Puppeteer opens Web Blockbench headlessly, injects [geyser_model_engine_packer.js](geyser_model_engine_packer.js), uploads models in batches of 50, invokes the plugin's “export all” action, merges each downloaded batch into the final restored directory tree, and writes `meg-bedrock.zip`.
- [geyser_model_engine_packer.js](geyser_model_engine_packer.js) runs inside Blockbench, not Node.js. It registers a Blockbench codec that parses Bedrock geometry into Blockbench objects and compiles Blockbench projects back into GeyserModelEngine geometry. Its export actions package textures, `.geo.json`, optional `.animation.json`, and `config.json` into ZIP archives. It depends on Blockbench globals such as `Project`, `Group`, `Cube`, `Texture`, `Animator`, `JSZip`, and `Blockbench`.
- [\.github/workflows/convert.yml](.github/workflows/convert.yml) runs conversion on pushes to `master` or manually via `workflow_dispatch` with a required direct `zip_url`. CI uses Node 20, installs Puppeteer Linux packages, runs `node convert.js`, and uploads `meg-bedrock.zip` as the `Bedrock-GeyserMC-Output` artifact.

Runtime staging directories (`workspace/`) and generated input/output ZIP files are intentionally ignored by [\.gitignore](.gitignore). Keep the browser/plugin boundary intact: Node-side orchestration belongs in `convert.js`; Blockbench API and model conversion logic belongs in `geyser_model_engine_packer.js`.
