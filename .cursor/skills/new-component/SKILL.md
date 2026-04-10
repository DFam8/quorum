---
name: new-component
description: Scaffolds Vue 3 Nuxt components for Quorum with correct file placement, Base/The naming, script setup, scoped nested mobile-first CSS using tokens, and Radix Vue patterns. Use when creating or refactoring components, pages, or when the user mentions new UI, Radix Vue, scoped styles, or design tokens.
---

# New component (Quorum)

## Before writing

1. Classify the component: **Base** primitive, **The** layout singleton, **feature** noun, or **page** (see naming below).
2. Confirm data and permissions: use tRPC via composables; use `utils/permissions.ts` helpers — never inline role string checks. Board-only UI uses `v-if` (hidden), not disabled-only.

## File placement (Nuxt)

| Kind | Location | Example |
|------|----------|---------|
| Reusable UI | `components/` | `components/BaseButton.vue` |
| Feature UI | `components/` | `components/MeetingCard.vue` |
| Layout shell | `components/` | `components/TheSidebar.vue` |
| Route view | `pages/` | `pages/meeting-detail.vue` |

Nuxt auto-imports from `components/`. Prefer colocating small feature-specific subcomponents next to a parent only when they are not reused elsewhere (still under `components/` with a clear prefix or subfolder).

## Naming

- **Base** — primitives: `BaseButton.vue`, `BaseInput.vue`, `BaseModal.vue`
- **The** — one-per-app layout: `TheNavbar.vue`, `TheSidebar.vue`
- **Feature** — domain noun: `AnnouncementFeed.vue`, `MeetingCard.vue`
- **Pages** — kebab-case matching route: `meeting-detail.vue`

## Single-file structure

Order blocks consistently:

1. `<template>`
2. `<script setup lang="ts">`
3. `<style scoped>` (required on every component)

### Script setup rules

- Composition API only; `defineProps` and `defineEmits` with **typed** generics.
- Explicit return types on functions.
- No `any` — use `unknown` and narrow.
- Prefer `type` over `interface` unless extending.
- Keep files focused; split if approaching ~150 lines.

### Template rules

- Use permissions helpers for conditional rendering; board-only sections fully hidden with `v-if`.
- Images: meaningful `alt` or `alt=""` when decorative.

## Scoped CSS pattern

- **Always** `<style scoped>`. Never Tailwind. No inline styles except truly dynamic values (e.g. bound coordinates).
- **Tokens**: every color, space, font size, radius, and motion (where defined) comes from `assets/tokens.css` as `var(--token-name)`. No raw hex or ad-hoc pixel font sizes in components.
- **Nested CSS** (native nesting): group by block; keep selectors shallow.
- **Mobile first**: base rules for smallest viewport; use `@media` min-width for larger breakpoints.
- **No BEM**: avoid `block__elem--mod`; use a short wrapper class and nest, or one component root class.
- **Constraints** (from project rules): font weights **400 and 500 only**; box shadow only `--shadow-focus` on focus rings; gradients only `--gradient-brand` / `--gradient-brand-subtle` on logo mark and primary CTA; no glassmorphism, blur, or transparency effects.

### Focus and hit targets

- Interactive elements: visible focus using `var(--shadow-focus)`.
- Minimum touch target **44×44px** for controls.

### Example skeleton

```vue
<template>
  <div class="feature-card">
    <h2 class="title">{{ title }}</h2>
    <slot />
  </div>
</template>

<script setup lang="ts">
type Props = {
  title: string
}

const props = defineProps<Props>()
</script>

<style scoped>
.feature-card {
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface);

  .title {
    font-size: var(--text-step-1);
    font-weight: 500;
    color: var(--color-text);
    margin: 0 0 var(--space-3);
  }

  @media (min-width: 48rem) {
    padding: var(--space-6);
  }
}
</style>
```

Replace token names with real names from `assets/tokens.css` when implementing.

## Radix Vue

- Use Radix Vue primitives for dialogs, dropdowns, tabs, popovers, etc., instead of building keyboard/focus trapping from scratch.
- **ARIA**: Radix sets appropriate roles and attributes; do **not** duplicate `aria-*` on the same primitive unless a project pattern explicitly requires an exception.
- **Styling**: target `data-state`, `data-disabled`, and similar data attributes from Radix for visual states; keep styles in scoped CSS using tokens.
- **Composition**: prefer wrapping Radix parts in **Base** components (e.g. `BaseModal` wraps Dialog parts) so feature code stays consistent.
- **`asChild`**: when merging behavior onto a native or Base element, use `asChild` where the primitive supports it so semantics and focus management stay correct.

## Checklist

- [ ] Correct folder and name (Base / The / feature / page)
- [ ] `script setup lang="ts"` with typed props/emits and explicit function return types
- [ ] `<style scoped>` with nested, mobile-first CSS and `var(--*)` tokens only
- [ ] Focus rings and 44×44px targets for interactive elements
- [ ] Radix usage without redundant ARIA; state styled via data attributes
- [ ] Permissions and data access via helpers and tRPC composables, not inline in templates as string role checks

## See also

- Project-wide rules: `.cursorrules`
