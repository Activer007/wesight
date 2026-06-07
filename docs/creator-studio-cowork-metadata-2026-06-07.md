# Creator Studio Cowork Metadata - Phase 13D Check

## Semantics

Creator Studio now separates the two user intents:

- Send draft to Cowork: opens Cowork with a prefilled draft, attachments, active skills, and Creator Studio metadata. It does not start execution until the user confirms sending in Cowork.
- Start generation (confirm): opens a Cowork generation draft with explicit copy that Creative Producer runs only after the user confirms sending. The draft requests image generation when Seedream is available, with fallback prompt/steps if unavailable.

## Metadata-First Tracking

Creator Studio messages now include a `creatorStudio` top-level metadata object:

- `schemaVersion: creator.cowork.v1`
- `action`: one of the shared `CreatorCoworkAction` constants
- `promptSpec`: structured PromptSpec snapshot or snapshots
- `promptText`: the production prompt text
- `activeSkillIds`
- `source`: source identifiers such as template, case, asset, batch run, batch task, direction, model, and size

Legacy top-level fields (`promptSpec`, `promptText`, `requestedAction`, `source`) remain as compatibility mirrors, but new production run and asset provenance logic should prefer `metadata.creatorStudio`.

## Run And Asset Provenance

`CreatorAssetStore` now creates production runs from Cowork user message metadata before attempting text parsing. Generated image ingestion resolves context in this order:

1. Existing pending production run for the session.
2. Latest user message with valid `metadata.creatorStudio`.
3. Historical `[Creator Studio]` / `PromptSpec` text block fallback.

This preserves templateId, caseIds, PromptSpec, selected direction, batch task IDs, recipe IDs, and asset lineage even if the user edits the visible Cowork draft before confirming.

## Compatibility

- Existing `[Creator Studio]` text parsing remains in place for historical messages.
- Existing Cowork start and continue IPC behavior remains unchanged; metadata is passed through the existing message metadata channel.
- No image base64 payloads or API keys are added to Creator Studio metadata.

## Tests

Coverage now includes:

- Metadata-first run and asset provenance when the visible draft text no longer contains Creator Studio blocks.
- Existing text fallback parsing for historical Creator Studio drafts.
- Updated generation draft copy requiring user confirmation before execution.
