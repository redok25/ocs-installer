---
name: frontend-ui-ux
description: Default buyer-facing routing skill for UI, layout, styling, and UX work in the visual-engineering lane.
---

# Frontend UI/UX

## Use this skill when

- The task is clearly UI, UX, layout, styling, spacing, motion, hierarchy, or responsive frontend work.
- The user wants a component, page, dashboard, landing page, or visual flow to look or feel better.
- The runtime selected `category="visual-engineering"`.

## Primary owner job

- Act as the default visual routing skill for buyer-facing frontend work.
- Own the first-pass direction for layout, composition, styling, and interaction quality.
- Decide the main visual approach before any optional polish layer is added.

## What this skill does

- Sets the baseline visual direction for `visual-engineering` work.
- Covers component composition, spacing, typography, layout structure, responsive behavior, and interaction flow.
- Pushes work beyond generic AI-safe UI toward clearer visual hierarchy and more intentional presentation.
- Preserves the existing design system when one already exists in the repo.
- May layer `impeccable-style` when the task explicitly needs a high-polish finishing pass.

## What this skill does not do

- It does not own backend, infra, release, docs, or security work.
- It does not force a full redesign when the task only needs a narrow UI fix.
- It does not replace accessibility or responsive discipline with style-only decisions.
- It does not make `impeccable-style` mandatory for ordinary visual work.

## When to combine with another skill

- Combine with `impeccable-style` only when the user clearly wants premium polish, a stronger visual signature, or a final refinement pass.
- Combine with `ocs-runtime-validation` when the visual task also changes runtime-sensitive install, setup, or environment-dependent behavior.

## Pass criteria

- The visual task has one clear owner: `frontend-ui-ux`.
- The proposed or implemented UI direction is specific, intentional, and appropriate for the current product surface.
- The work improves hierarchy, spacing, composition, or interaction quality in a way a reviewer can point to concretely.
- Any use of `impeccable-style` is explained as optional polish, not as the default path.
- Accessibility and responsive behavior remain intact.

## Anti-patterns

- Treating `frontend-ui-ux` as a thin wrapper around `impeccable-style` instead of the primary visual router.
- Loading `impeccable-style` for every frontend task by default.
- Turning a small UI adjustment into a sweeping redesign without user intent.
- Ignoring existing design-system constraints in pursuit of novelty.
- Applying visual-heavy guidance to non-visual tasks.
