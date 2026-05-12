---
name: ocs-product-marketing-context
description: Capture and maintain the buyer-facing product context that copy, SEO, and onboarding skills should reuse.
---

# OCS Product Marketing Context

## Use this skill when

- A technical product needs a shared source of truth for product, audience, positioning, proof, and customer language.
- Multiple buyer-facing tasks are starting to repeat the same foundational context.
- Copy, onboarding, docs, or SEO work is blocked by fuzzy positioning or unclear audience assumptions.

## Primary owner job

- Own the reusable buyer-context document for OCS-style technical products.
- Turn scattered repo/product knowledge into one maintained context source that downstream skills can reuse.

## What this skill does

- Creates or updates a product-marketing-context document.
- Captures product overview, audience, jobs to be done, pain points, differentiation, proof, objections, and customer language.
- Pushes for verbatim customer phrasing when available.
- Gives downstream skills a stable context artifact so they do not keep rediscovering the same positioning facts.

## What this skill does not do

- It does not rewrite public-facing copy itself.
- It does not perform technical SEO diagnosis.
- It does not replace runtime or regression verification.

## When to combine with another skill

- Combine with `ocs-technical-copy-seo` after context is captured and the task becomes writing.
- Combine with `ocs-seo-audit` when search diagnosis or prioritization depends on clearer audience or topic framing.

## Pass criteria

- One maintained context document exists with enough detail for downstream copy/SEO work.
- The document captures product, audience, positioning, proof, objections, and customer language clearly.
- The context is specific enough that downstream skills can cite it instead of asking the same foundational questions again.

## Anti-patterns

- Turning this skill into a copywriting pass.
- Filling the context document with vague brand fluff instead of concrete buyer language.
- Duplicating the same foundational context separately across README, landing pages, and ad-hoc notes without a maintained source of truth.

## Default document path

- Preferred: `.agents/product-marketing-context.md`
- If another project-level path is already canonical, keep one clearly documented source of truth and link downstream tasks to it.
