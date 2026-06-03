// Admin users API — gated on `authDebug.tokenAuth === true` (ADMIN_API_TOKEN
// bearer) OR `userContext.isAdmin`. The token itself is the privilege
// boundary, so any SDK/agent holding it can enumerate users to resolve names.
export const name = 'admin-users';
export const API_LIST_USERS = 'admin/users/list';
export const API_GENERATE_PASSKEY_LINK = 'admin/users/generate-passkey-link';
