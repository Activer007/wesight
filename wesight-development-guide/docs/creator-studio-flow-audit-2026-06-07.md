# Creator Studio Flow Audit - 2026-06-07

## Scope

This audit covers TASK-03 Phase 13A items CS-13-01, CS-13-02, and CS-13-15. It focuses on the current user-facing entry paths into Creator Studio creation without changing the underlying asset model or generation services.

## Summary

Creator Studio now defaults to Start / Studio Home. The first screen should read as three creator tasks instead of a feature inventory:

- Generate images: write a one-line brief or pick a common scenario, then continue in Builder.
- Process images: drop local images or open Image Tools for quick edit, WebP, compression, and resize workflows.
- Find inspiration: browse cases, templates, and Nano prompts from Inspiration, then adapt one into Builder.

PromptSpec remains part of the internal data contract and advanced/technical surfaces, but it should not be the primary first-screen promise. Start page copy and primary actions use creator task language.

## Current Entry Paths

| Source | Current click path | Destination | Notes |
|---|---|---|---|
| One-line brief | Creator Studio -> Start -> write brief -> Start image project | Builder | `applyCreatorBriefAutofill()` fills the Builder form. The user sees a creator task entry instead of a PromptSpec draft button. |
| Common scenario chip | Creator Studio -> Start -> scenario chip | Builder | Scenario chips populate a ready brief and reuse the same Builder path. |
| Case | Creator Studio -> Start recommended inspiration or Inspiration -> Gallery -> case | Builder | Case prompt and provenance become Builder seed data. Start exposes cases as inspiration, not as a separate top-level module. |
| Template | Creator Studio -> Start recommended inspiration or Inspiration -> Templates -> template | Builder | Template fields remain editable in Builder. The template is presented as an inspiration starting point. |
| Nano prompt | Creator Studio -> Inspiration -> Nano Library -> prompt primary action | Builder | Nano prompt conversion still creates structured Builder data, while advanced Recipe / Board / Batch actions stay secondary. |
| Historical asset | Creator Studio -> Start recent assets or Assets -> asset action | Builder or image action | Assets can be reused as variants or sent into image tools depending on context. Source tracking remains asset-backed. |
| Local image | Creator Studio -> Start -> drag image | Image Tools if local file paths are available; Builder material tray if combined with brief | Local images with filesystem paths open the processing path directly. If a brief is present, the same files are also preserved as Builder reference materials. |
| Image tools | Creator Studio -> Start -> Process images / Open image tools | Image Tools panel | Image tools are discoverable from Start without requiring asset detail inspection. |

## Blocking Points

- First-screen wording previously exposed "PromptSpec draft" as the main CTA, which made the default path sound technical before users understood the creative task.
- Start contained the relevant abilities but did not visually separate "generate images", "process images", and "find inspiration" as three primary choices.
- Image processing was discoverable from Start, but the first-screen hierarchy made it feel like a tool card rather than one of the main creation starts.
- Advanced concepts such as PromptSpec, Recipe, Board, Batch, and Production Package still exist and remain necessary for power users, but they should stay in Builder advanced/technical areas or contextual actions rather than first-screen task language.

## Phase 13A Changes

- Start first screen now presents three task cards: Generate images, Process images, and Find inspiration.
- The brief CTA is task-based: Start image project / 开始创作图片.
- Start subtitle explains that users can begin from a sentence, image, case, or past asset, while the immediate first-screen choices are creator tasks.
- New Start task labels and descriptions are added to zh/en i18n.
- Existing Start, Inspiration, Builder, and Assets paths are preserved.

## Acceptance Check

| Requirement | Status | Evidence |
|---|---|---|
| Creator Studio defaults to Start / Studio Home | Done | `CreatorStudioView` initializes `activeTab` with `CreatorStudioTab.Start`. |
| First screen expresses generate images / process images / find inspiration | Done | Start task cards use `creatorStartGenerateImageTitle`, `creatorStartProcessImagesTitle`, and `creatorStartFindInspirationTitle`. |
| Primary Start CTA is not PromptSpec-oriented | Done | `creatorStartCreateDraft` now reads as a creator task in zh/en. |
| PromptSpec copy remains available only in technical/advanced contexts | Done for Phase 13A scope | Start first-screen copy no longer uses PromptSpec. Existing PromptSpec labels remain in Builder preview, recipe/package, and technical descriptions. |
| Existing Start, Inspiration, Builder, Assets routes remain intact | Done | The change reuses existing handlers and tab destinations without removing routes. |
