Create a new Nuxt page for the Quorum project.

Ask me:
1. What is the page route? (e.g. /meetings/[id], /portal/profile)
2. What layout does it use? (default = authenticated sidebar layout, auth = centered minimal, board = board dashboard)
3. What middleware does it need? (auth / board-only / super-admin-only / none)
4. What is the page's primary purpose in one sentence?
5. What tRPC data does it need to fetch?

Then generate the complete page file following these rules:
- Use <script setup lang="ts">
- Add definePageMeta with correct layout and middleware
- Use useTrpc() composable to call tRPC procedures (not useFetch directly)
- Handle loading and error states explicitly
- Use components from the correct components/ subfolder
- No inline styles — use scoped CSS with var(--token-name) only
- Board-only UI uses v-if based on role, never v-show or disabled

Output the complete file content ready to paste.