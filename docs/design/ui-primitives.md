# Cross-cutting UI primitives

These appear on many pages — design once, reuse:

| Primitive | Where used | Notes |
|---|---|---|
| Data table (server-paginated) | every list page | TanStack Table + URL state for filters / sort / page |
| Detail-page header | Order, Cutting, Sewing, Fabric | Status pill + timestamps + actions. Same component, different status enum |
| Resource picker | Order line items, Cutting fabric, Product spec/print | Combobox + create-on-the-fly. shadcn `<Command>` based |
| Side-sheet form | Quick-create entities | Use side-sheet for forms with > 5 fields, modal for confirmations |
| Empty state with CTA | every list page | Illustration + 1-2 sentence + primary action |
| Activity / audit timeline | detail pages | Reads from AuditLog filtered by resource |
| Status pill | everywhere | Maps enum → color. One component per enum family |
| Command palette (⌘K) | top bar | Global search across orders, products, clients, fabric rolls |
| Company switcher | top bar | Dropdown of companies user belongs to; switching reloads the shell |
