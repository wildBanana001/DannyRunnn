# Design QA

## Target and scope

- Reference: `/var/folders/x2/qq6c7jv17pv5wd64v40d41p40000gn/T/codex-clipboard-f649dbc9-7e7b-4d99-ab1e-1e76a2fca259.jpg`
- Implementation: `worker_house/src/pages/home`, with the same visual language extended to activity, shop, wall, mine, product detail, order confirmation, and order history.
- Reference dimensions: 1080 × 10558 px.
- Browser QA viewport: 1280 × 720 px at DPR 2, with the H5 mini-program canvas constrained to 390 × 720 CSS px.
- State tested: default home, long-page mid and bottom sections, activity list, shop list, product detail, wall, mine, and join-community bottom sheet.

## Visual comparison

- Compared the supplied full reference and the implementation's top, collage, space, stories, and owner screenshots together in one comparison input.
- Matched the warm cream paper background, hand-lettered titles, rough black image buttons, red micro-accents, large editorial whitespace, right-weighted collage, full-bleed room image, stacked story photography, oval owner portraits, and centered closing badge.
- Reused the supplied/project artwork where available. Added a project-local generated room photograph for the missing full-bleed space section and local fallbacks for network images.
- Removed glossy cards, gradients, large radii, emoji icons, and decorative shadows from the primary experience.

## Issues found and fixed during QA

- Fixed H5 `widthFix` text assets rendering at a default 240 px height, which created large unintended gaps.
- Fixed the hero image container's missing explicit height.
- Fixed desktop H5 previews scaling `rpx` against a wide browser viewport by constraining the app canvas to mini-program width.
- Fixed blank remote covers and avatars with delayed local image fallbacks.
- Fixed fixed purchase/payment bars overflowing the mini-program canvas on desktop H5.
- Fixed the community sheet stacking beneath the native H5 tab bar without introducing console warnings.

## Interaction and runtime checks

- Bottom navigation, shop-to-product navigation, community-sheet open, activity tabs, and primary CTAs were exercised in the in-app browser.
- Final browser console check: no errors or warnings.
- `npm run typecheck`: passed.
- `TARO_OUTPUT_DIR=/private/tmp/worker-house-h5-design npm run build:h5`: passed; only existing bundle-size performance warnings remain.
- `npm run build:weapp`: passed; only bundle-size/code-splitting performance warnings remain.
- `npm run ci:weapp:validate`: passed for AppID `wx06f0bff0bed0dc80`.
- `git diff --check`: passed.

final result: passed
