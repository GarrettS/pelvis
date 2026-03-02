# Project Conventions

## Code Style
- Follow Google JavaScript Style Guide.
- Follow Google CSS Style Guide: one declaration per line, opening brace on selector line, one blank line between rules.
- Follow Google HTML Style Guide: semantic elements, lowercase, quoted attributes.
- Vanilla JS only. No frameworks, no jQuery, no build tools.
- No landmark/banner comments (═══, ───). Use code structure (classes, functions, named objects) instead.

## HTML
- Semantic elements: headings not divs, nav lists not buttons, appropriate ARIA roles.
- No inline styles except those set dynamically by JS at runtime.
- don't add "self-closing syntax" slash where end tag is forbidden.

## CSS
- External stylesheets only. No inline <style> blocks.
- layout.css for structure, components.css for UI components.
- put css files in css directory

## JS
- Hash-based navigation with location.hash and hashchange listener. No History API (pushState/popstate).
- Delegated event listeners. No inline event handlers.
- ES modules with type="module" on script tags.
- external js files go in scripts directory

## JSON 
- goes in data directory
- extension .json

## images
- go in img directory

## After Every Change
- Remove dead code: orphaned selectors, unreferenced IDs, stale variable references.
- Update all selectors and references affected by structural changes.
- Run verification commands to confirm no regressions. Do not finish with failing checks.
- Do not write transformation scripts to batch-edit files. Make direct edits, one change at a time, verifying each.