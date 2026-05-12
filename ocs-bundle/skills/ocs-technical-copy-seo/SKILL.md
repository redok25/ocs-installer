---
name: ocs-technical-copy-seo
description: Create high-conversion, SEO-safe technical product copy for install, onboarding, setup, docs, and landing surfaces.
---

# OCS Technical Copy + SEO

## Use this skill when

- Updating install, onboarding, setup, documentation, or landing-page messaging for a technical product or project.
- You need conversion-focused copy with a clear value proposition and CTA without sounding generic.
- You need SEO fundamentals such as title intent, keyword placement, and scannable structure in the same pass.

## Primary owner job

- Own buyer-facing technical copy for install, onboarding, setup, docs, and public product surfaces.
- Combine conversion structure and SEO fundamentals in one writing pass.

## What this skill does

- Defines the offer, audience, pain point, and promised outcome before drafting copy.
- Drafts copy in a repeatable section order such as hero, value proposition, trust, feature outcomes, FAQ objections, and CTA.
- Adds an SEO layer with keyword intent, title candidates, meta description candidates, and heading structure.
- Keeps public-facing copy benefit-first and audience-appropriate.

## What this skill does not do

- It does not act as a product-context source of truth.
- It does not replace a dedicated SEO diagnostic skill.
- It does not act as a markdown cleanup or markdown verification skill.
- It does not replace a dedicated runtime-proof or regression-proof workflow.

## When to combine with another skill

- Combine with `ocs-product-marketing-context` before drafting when positioning, audience, or customer language still needs to be clarified.
- Combine with `ocs-seo-audit` when the job is diagnosis and prioritization rather than writing.
- Combine with `ocs-markdown-autofix` after editing markdown files so formatting and markdown verification are handled explicitly.

## Pass criteria

- The copy clearly states who the surface is for, why it matters, and what action the reader should take next.
- Public messaging stays benefit-first and avoids unnecessary internal stack detail.
- The output includes at least two headline options, two CTA variants, and one explicit SEO block.
- If markdown files were edited, the task is handed to `ocs-markdown-autofix` for formatting and markdown verification.

## Anti-patterns

- Publishing technical product copy with unnecessary internal dependency detail.
- Writing feature-only copy with no promised outcome or CTA.
- Stuffing keywords unnaturally.
- Treating markdown cleanup as part of this skill instead of handing it to `ocs-markdown-autofix`.
- Finalizing public copy without objection handling or trust framing when the surface needs it.

## Prompt pack

### Quick decision

- Need technical copy + SEO fundamentals in one pass? **Yes**.
- Recommended baseline in OCS: `ocs-technical-copy-seo`.
- Upstream context companion: `ocs-product-marketing-context`.
- Markdown companion: `ocs-markdown-autofix`.
- Diagnostic SEO companion: `ocs-seo-audit`.

### Output target (per copy pass)

1. Hero
2. Value proposition
3. Social proof / trust
4. Feature outcomes
5. FAQ objections
6. CTA block
7. SEO snippet (keyword/title/meta/H2 map)

### Prompt template (English)

```text
Act as a conversion copywriter for our public technical product surface.

CONTEXT
- Product: <product / project / installer name>
- Surface: <README / landing page / install guide / onboarding page / docs page>
- Audience: <who is evaluating this>
- Goal: increase conversion while keeping messaging honest and clear
- Constraint: public copy must stay high-level unless technical detail is clearly useful to the audience

TASK
Rewrite/propose these sections in order:
1) Hero headline + subheadline + primary CTA
2) Value proposition (3 bullets)
3) Trust/proof block (3 bullets)
4) Feature outcomes (4 bullets, user-benefit phrasing)
5) FAQ (5 objections + concise answers)
6) Secondary CTA

SEO REQUIREMENTS
- Primary keyword: <fill>
- Supporting keywords: <fill 2-4>
- Provide:
  - 2 SEO title options (<= 60 chars)
  - 2 meta descriptions (<= 155 chars)
  - H2 structure map (4-6 items)
- Keep keyword use natural (no stuffing)

OUTPUT FORMAT
- Section-by-section markdown
- Include Option A and Option B for hero + primary CTA
```

### Minimal validation after editing docs

```bash
bun run lint:md:fix -- "<file-1>.md" "<file-2>.md"
bun run lint:md -- "<file-1>.md" "<file-2>.md"
```
