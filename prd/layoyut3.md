The subtabs scroll. I want them sticky and flush to the tabs.

Move all .subtab-row elements out of their <section> tabs and into the nav as nested <ul> inside each tab's <li>. Only the active tab's subtab-row should be visible. Update JS to show/hide the correct subtab-row when the active tab changes.

Do the same for .subview-tabs — move them into nav as a third nested <ul> level inside the appropriate subtab's <li>. Only the active subtab's subview list should be visible.

Update all CSS selectors that target .subtab-row or .subview-tabs relative to section or main ancestors to match their new position inside nav.

Remove any dead CSS or JS references left behind by the move.

Verify: all three nav tiers stick to top on scroll, no orphaned selectors referencing old DOM positions.