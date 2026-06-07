# Creator Studio Phase 13E/13F Audit

Date: 2026-06-07

## Phase 13E - Next Actions and contextual advanced entrypoints

- Asset cards now expose a visible `Next actions` group instead of a flat icon strip. Existing actions remain available: use as reference, send draft to Cowork, copy prompt, open source, view details, and image tools when the asset can be processed.
- Asset details now group reference, Cowork draft, source, reveal in folder, image tools, and reusable image Recipe execution under `Next actions`, keeping provenance and metadata inspection separate from production actions.
- Cowork generated image cards now show `Next actions` directly below each result. Users can open the preview/metadata inspector, adopt/favorite the result, request a variant, quick edit, prepare the asset for batch processing, save a Recipe when structured prompt data exists, reveal the output file, or inspect the source without first discovering the expanded image overlay.
- Board, Batch, Recipe, PromptSpec, and production package remain available as Builder advanced/contextual entrypoints. The top-level navigation stays focused on Start, Inspiration, Builder, and Assets.

## Phase 13F - secondary lazy loading and performance guard

- `CreatorStudioView` lazy-loads the heavier second-level modules: Assets, Nano Library, Board, Batch, image processing batch panel, and quick edit drawer.
- Start and Inspiration Gallery/Templates render without importing Assets, Board, Batch, Nano detail workflows, or the image post-processing drawer in the initial Creator Studio module.
- Cowork image post-processing now lazy-loads the quick edit drawer only when a generated image is actually sent into image tools.
- Existing image previews continue to use browser image lazy loading, and Gallery pagination remains the primary guard against loading all case media at once.

## Phase 13E - workflow extraction

- `useCreatorStartFlow` owns Start brief and local-image entry decisions: brief opens Builder, local image paths open Image Tools, and mixed brief+images keeps Builder context for later generation.
- `useCreatorCoworkBridge` owns Creator Studio to Cowork draft construction, active skill activation, structured `messageMetadata.creatorStudio`, and the PromptDraft / StartGeneration / AssetVariant / BatchTask / BatchRun action split.
- `useCreatorImageActions` owns reusable image-processing actions shared by Assets, Image Tools, and processing history: retry, cancel, report open, and image Recipe execution.
- `CreatorStudioView` remains the view composer and state owner, but new cross-module workflow actions no longer continue to accumulate directly in the top-level container.

## Regression checklist

- Default Creator Studio entry remains Start / Studio Home.
- Inspiration still contains Gallery, Templates, and Nano Library; Nano loads on demand.
- Builder keeps the lightweight default view while advanced Board, Batch, PromptSpec, Recipe, and production package entrypoints remain available.
- Image tools can be reached from Start, Assets, Builder materials, and Cowork generated image cards.
- Production run tracking remains metadata-first; text parsing is fallback only.
- Manual end-to-end checks are recorded in `wesight-development-guide/docs/TASK-03.md` for brief first order, case-to-Builder, drag-to-process, Cowork result quick edit, metadata-first provenance, and lazy chunk observation.

## Follow-up refinements

- Image Tools now keeps task semantics separate: Compress groups selected assets by detected source format and preserves PNG/JPEG/WebP/AVIF when possible, while Convert to WebP always creates WebP outputs.
- Builder default source chips no longer expose raw `template:` or `cases:` field labels; they use creator-facing labels for template origin and reference case count.
- Start Generation remains explicitly a Cowork generation draft that requires user confirmation until a direct background generation runtime is available.

## Manual end-to-end checklist

1. Brief first order: open Creator Studio Start, enter one brief, send to Cowork draft or Start Generation, and confirm `metadata.creatorStudio.action` distinguishes `prompt_draft` and `start_generation`.
2. Case to Builder: open Inspiration Gallery, choose one case, use the primary action into Builder, and confirm the default Builder view stays focused on brief, subject, platform/aspect, text, materials, and main action.
3. Drag to process: return to Start, drag three local images, confirm Image Tools opens with processable images selected, then run compress, WebP, cover resize, or inspect.
4. Cowork result quick edit: generate an image in Cowork, use the result-card Next Actions quick edit, and confirm the output asset is saved back to Creator Assets.
5. Metadata-first provenance: edit the visible Cowork draft after Start Generation and remove visible structured blocks; generated assets should still retain templateId, caseIds, PromptSpec, requestedAction, and source session from metadata.
6. Lazy chunk observation: open only Start or Inspiration Gallery and confirm CreatorAssetGrid, NanoLibraryView, CreatorBoard, CreatorBatchPanel, CreatorImageProcessingBatchPanel, and ImageQuickEditDrawer chunks are not requested until those secondary paths are opened.
