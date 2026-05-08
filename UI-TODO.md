# UI Todo

## Done

1. **Header & Corporate Orange** — Admin pages now use white header with subtle border (`bg-white border-b border-sagals/20`). Public pages (EventList, ListPage) keep orange header for brand presence.

2. **Button & Action Style Inconsistency** — Activar/Desactivar now have Power icon. Destructive actions (Eliminar actuació, Esborrar participants) now have Trash2 icon with consistent red text.

3. **Visual Hierarchy** — Status badge changed from filled pill on orange to subtle bordered pill on white background. Draft/Actiu/Tancat all use light background pills instead of heavy filled ones.

4. **Icon Usage** — Activar/Desactivar got Power icon. All destructive actions got Trash2 icon. Consistent icon usage for action buttons.

5. **Destructive Action Consistency** — Both "Eliminar actuació" and "Esborrar participants" now use same pattern: Trash2 icon + red text + `flex items-center gap-1`.

## Remaining

6. **Interaction States** — Pills and text links still have slightly different hover/focus patterns. Consider unifying: consistent background fill on hover for all action buttons.