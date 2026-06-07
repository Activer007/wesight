# Creator Studio Phase 13E/13F Audit

Date: 2026-06-07

## Phase 13E - Next Actions and contextual advanced entrypoints

- Asset cards now expose a visible `Next actions` group instead of a flat icon strip. Existing actions remain available: use as reference, send draft to Cowork, copy prompt, open source, view details, and image tools when the asset can be processed.
- Asset details now group reference, Cowork draft, source, reveal in folder, image tools, and reusable image Recipe execution under `Next actions`, keeping provenance and metadata inspection separate from production actions.
- Cowork generated image cards now show `Next actions` directly below each result. Users can open the preview/metadata inspector or enter Creator image tools without first discovering the expanded image overlay.
- Board, Batch, Recipe, PromptSpec, and production package remain available as Builder advanced/contextual entrypoints. The top-level navigation stays focused on Start, Inspiration, Builder, and Assets.

## Phase 13F - secondary lazy loading and performance guard

- `CreatorStudioView` lazy-loads the heavier second-level modules: Assets, Nano Library, Board, Batch, image processing batch panel, and quick edit drawer.
- Start and Inspiration Gallery/Templates render without importing Assets, Board, Batch, Nano detail workflows, or the image post-processing drawer in the initial Creator Studio module.
- Cowork image post-processing now lazy-loads the quick edit drawer only when a generated image is actually sent into image tools.
- Existing image previews continue to use browser image lazy loading, and Gallery pagination remains the primary guard against loading all case media at once.

## Regression checklist

- Default Creator Studio entry remains Start / Studio Home.
- Inspiration still contains Gallery, Templates, and Nano Library; Nano loads on demand.
- Builder keeps the lightweight default view while advanced Board, Batch, PromptSpec, Recipe, and production package entrypoints remain available.
- Image tools can be reached from Start, Assets, Builder materials, and Cowork generated image cards.
- Production run tracking remains metadata-first; text parsing is fallback only.
