# UI Todo

## Priority fix: Unify button style first (solves hierarchy, interactions, and icon issues in one go), then reduce header orange footprint.

1. **Header & Corporate Orange** — Reduce height or use lighter tint for background; keep corporate hex for interactive accents only. Alternatively, thin top strip or bottom border instead of full-height block. Ensure header elements feel balanced.

2. **Button & Action Style Inconsistency** — Three button treatments on one screen (pill, text+icon, bare text). Choose one dominant language:
   - Option A (Recommended): Text+icon for all, remove pill from "Esborrany", uniform padding/spacing, destructive in red.
   - Option B: Outlined/ghost pills for all actions consistently.

3. **Visual Hierarchy** — "Esborrany" (draft) is low-importance but gets the heaviest visual treatment (filled pill). Primary actions should carry the most weight.

4. **Icon Usage** — Inconsistent: "+ Afegir" and "Sincronitzar" have icons, others don't. Either all actions get icons, or clear rule about when icons appear.

5. **Destructive Action Consistency**
   - Terminology: "Eliminar actuació" vs "Esborrar participants" — standardize on one verb throughout.
   - Styling: same hover state, same icon (trash), same placement.

6. **Interaction States** — Pills and text links have disjoint hover/focus/pressed states. Unified system: consistent background fill on hover for text links or darken for pills.