# Project Conventions
Clean Code, Modular Code. Apply continuous, disciplined improvement of code quality through small, incremental refactoring. Strive for the coding 

## Code Style
- Follow Google JavaScript Style Guide.
- Follow Google CSS Style Guide: one declaration per line, opening brace on selector line, one blank line between rules.
- Follow Google HTML Style Guide: semantic elements, lowercase, quoted attributes.
- Vanilla JS only. No frameworks, no jQuery, no build tools.
- No landmark/banner comments (═══, ───). Use code structure (classes, functions, named objects) instead.
- use ubiquitous language: variables, PRD, and code should remain consistent.
- Variables: Declare variables in the narrowest possible scope; avoid global variables and undeclared identifiers (always use var, let, or const). 
- Methods: Keep functions simple and focused (single responsibility), avoid long parameter lists, and ensure consistent return types. Test both success ("happy path") and failure ("sad path") scenarios. 
- DOM & Events: Avoid looping through DOM elements to apply styles or add event listeners. Instead, use event delegation (attach event handlers to a common ancestor) and CSS classes to manage visual states. 
- Strings & Loops: Use efficient string concatenation (e.g., String.prototype.concat() or array push()), and avoid unnecessary loops or chained identifiers. 

## HTML
- Semantic elements: headings not divs, nav lists not buttons, appropriate ARIA roles.
- Keep DOM light. Do not add div/span unless they are necessary.
- No inline styles except those set dynamically by JS at runtime.
- don't add "self-closing syntax" slash where end tag is forbidden.

## CSS
- External stylesheets only. No inline <style> blocks.
- layout.css for structure, components.css for UI components.
- put css files in css directory
- For CSS functions, like rgb(), include a single space after each comma for readability. 

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
- if SimpleHttpServer was run for local user testing, restart it, to reflect changes.

## Committing
- Review code again to re-check it against the standards defined herein and notify user.

## Building
- Do not use heredocs with template literals — the tool parser chokes on ${} substitutions. See CC-BUILD-SPEC.md

                                    