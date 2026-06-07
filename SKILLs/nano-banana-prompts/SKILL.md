---
name: nano-banana-prompts
description: Search, read, recommend, and convert Nano Banana visual prompts from the local WeSight Nano cache. Use this skill when the user asks for Nano prompts, visual prompt inspiration, image prompt remixing, Creator PromptSpec conversion, or prompt variants.
official: true
version: 0.1.0
---

# Nano Banana Prompts

Use this skill when the user needs visual prompt inspiration from the Nano Banana prompt library, wants to remix image prompts, asks for Nano prompts, or wants to convert a Nano prompt into a WeSight Creator PromptSpec.

This skill is read-only. It does not manage the Nano content library and does not fetch Nano remote feeds. It reads the local WeSight Nano Core cache exported by Creator Studio Nano Library.

## Boundaries

Use this skill for:

- Nano Banana prompts.
- Visual prompt inspiration.
- Image prompt remix ideas.
- Creator PromptSpec conversion.
- Prompt variants and creative directions.

Do not use this skill for:

- General coding tasks.
- Legal, medical, or financial advice.
- Non-visual writing tasks.
- Managing, deleting, editing, or curating the Nano content library.

## Cache Requirement

The scripts read only this exported cache:

```text
{WeSight userData}/NanoBanana/cache/index.json
{WeSight userData}/NanoBanana/cache/prompts/*.json
```

If the cache is missing, ask the user to open Creator Studio -> Nano Library and sync Nano prompts first.

For local testing, pass `--cache-dir /path/to/cache` or set `WESIGHT_NANO_CACHE_DIR`.

## Commands

Search for prompts:

```bash
node "$SKILLS_ROOT/nano-banana-prompts/scripts/nano-search.mjs" --query "科技公众号头图" --limit 6
```

Get a prompt by id:

```bash
node "$SKILLS_ROOT/nano-banana-prompts/scripts/nano-get.mjs" --id "nano-supai:6845"
```

Recommend 3-6 candidates for a visual brief:

```bash
node "$SKILLS_ROOT/nano-banana-prompts/scripts/nano-recommend.mjs" --brief "找几个适合公众号科技头图的 Nano Prompt" --limit 6
```

Convert a prompt into Creator PromptSpec JSON:

```bash
node "$SKILLS_ROOT/nano-banana-prompts/scripts/nano-convert-spec.mjs" --id "nano-supai:6845"
```

## Output Contract

All scripts print JSON to stdout. Search and recommend results include:

- `id`
- `title`
- `source`
- `author`
- `sourceUrl`
- `matchReason`

Prompt details and PromptSpec conversion preserve Nano provenance so Creator Studio can trace the original source.

## Workflow Guidance

For a request such as "找几个适合公众号科技头图的 Nano Prompt":

1. Run `nano-recommend.mjs` with the user's brief and `--limit 6`.
2. Return 3-6 candidates with concise match reasons, source, and author.
3. If the user chooses one, run `nano-get.mjs` for the full prompt.
4. If the user asks to use it in Creator Studio, run `nano-convert-spec.mjs` and return the PromptSpec JSON summary.
