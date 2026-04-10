Create a new Vue component for the Quorum project.

Ask me:
1. What is the component name? (e.g. MeetingCard, BaseButton, TheSidebar)
2. What domain does it belong to? (base / layout / announcements / meetings / messaging / portal / dashboard / onboarding / ai)
3. What props does it need?
4. What does it emit?
5. What is its basic purpose in one sentence?

Then generate the complete component file following these rules:
- Use <script setup lang="ts"> with Composition API only
- Define props with defineProps<{}>() typed explicitly
- Define emits with defineEmits<{}>() typed explicitly
- Use <style scoped> with CSS custom properties from assets/tokens.css only
- No hardcoded colors, sizes, or spacing — only var(--token-name)
- No Tailwind classes
- No inline styles except for dynamic values
- Use Radix Vue for any interactive primitive (modal, dropdown, select, toggle, tooltip)
- Two font weights only: var(--font-normal) and var(--font-medium)
- Place file in the correct components/ subfolder based on the domain
- Keep under 150 lines — note if it should be split

Output the complete file content ready to paste.