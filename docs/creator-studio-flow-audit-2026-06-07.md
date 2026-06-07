# Creator Studio Flow Audit - 2026-06-07

## Scope

TASK-03 Phase 13A audits the current Creator Studio entry paths and adds a Start / Studio Home default entry without changing the production asset model.

## Current Entry Paths

| Entry | Current path | Working capability | Main friction |
|---|---|---|---|
| Intent / one-line brief | Creator Studio -> Builder -> Natural-language brief -> Fill empty fields | `applyCreatorBriefAutofill()` can create a PromptSpec draft from a sentence | New users must know Builder is the right tab and then understand the dense Builder surface |
| Gallery case | Creator Studio -> Gallery -> case card / drawer -> Generate | `startFromCase()` reverse-engineers the prompt, carries case tags, and attaches the case image as a reference material | Gallery is one of many equal top-level tabs; users must choose it before knowing whether they want inspiration or generation |
| Nano prompt | Creator Studio -> Nano Library -> prompt detail -> Use in Builder / Cowork / Recipe / Prompt Asset / Board / Batch | `nanoPromptToCreatorPromptSpec()` preserves source, translation, reference-image needs, and provenance | Nano exposes many parallel actions, so the primary "continue creating" path competes with asset and batch operations |
| Template | Creator Studio -> Templates -> Use template | `startFromTemplate()` seeds template fields, guidance, pitfalls, case ids, and tags into Builder | Templates are separate from Gallery and Nano, requiring users to understand the source taxonomy before starting |
| Historical asset | Creator Studio -> Assets -> asset action -> Use as reference / Send to Cowork | `useAssetAsReference()` creates an asset variant seed and attaches image assets as reference materials | Assets are mostly presented as governance and library management, not as a first-order restart path |
| Local image | Creator Studio -> Builder -> Materials -> drag / paste image | Material tray creates builder materials with data URLs and image analysis | The image-first path is hidden inside Builder and is not discoverable from the default Creator Studio page |
| Image tools | Creator Studio -> Batch -> Image processing, or asset detail / actions | Existing image processing supports inspection, quick edit, batch processing, output reveal, and recipe execution | Tools are discoverable only after entering Batch or asset-specific contexts; users can miss them when they only need processing |

## Start / Studio Home Decision

Phase 13A makes Start the default tab and keeps existing tabs as advanced entry points. Start focuses on first-order creation rather than marketing copy:

- One-line brief creates a Builder PromptSpec draft through the existing autofill path.
- Scenario chips prefill common creator briefs and immediately open Builder.
- Dragging local images from Start creates Builder materials, so users can begin from images without finding the material tray first.
- Recent assets expose the asset-variant path directly from the first page.
- Recommended inspiration surfaces cases and templates without forcing the user to choose a source taxonomy upfront.
- Image tools shortcut opens the dedicated Image Tools panel, so image inspection, quick edit, batch processing, output reveal, processing history, and reusable processing paths are visible from the default page.

## Deferred Follow-Ups

- Collapse Gallery, Templates, and Nano into a single Inspiration entry after Phase 13A proves the Start path.
- Move Nano secondary actions into a lower-priority menu.
- Split Builder into default light mode and an advanced section for PromptSpec, package, recipe automation, and governance.
- Keep consolidating duplicated image action copy as more Cowork and result-card surfaces adopt the shared Image Tools entry.
- Continue metadata-first run tracking so edited Cowork text does not break provenance.
