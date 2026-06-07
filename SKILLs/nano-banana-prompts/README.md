# Nano Banana Prompts Skill

Read-only WeSight skill for searching Nano Banana prompts, retrieving cached prompt details, recommending visual prompt candidates, and converting a cached Nano prompt to a Creator PromptSpec-shaped JSON object.

## Data Source

This skill never fetches the remote Nano site. It reads the WeSight Nano Core read-only cache:

```text
{WeSight userData}/NanoBanana/cache/index.json
{WeSight userData}/NanoBanana/cache/prompts/*.json
```

For local testing, pass `--cache-dir` or set `WESIGHT_NANO_CACHE_DIR`.

## Commands

```bash
node scripts/nano-search.mjs --query "科技公众号头图" --limit 6
node scripts/nano-get.mjs --id "nano-supai:6845"
node scripts/nano-recommend.mjs --brief "找几个适合公众号科技头图的 Nano Prompt" --limit 6
node scripts/nano-convert-spec.mjs --id "nano-supai:6845"
```

All commands print JSON to stdout. Missing cache or missing detail prompts also return JSON with `success: false`.

## Cache Contract

See `schema/cache-index.schema.json` for the exported index shape. Detail prompt files use the public Nano prompt fields exported by Nano Core and are referenced from `index.json` through `promptFiles`.
