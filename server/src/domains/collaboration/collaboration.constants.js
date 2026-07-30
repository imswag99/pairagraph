// Single source of truth for writingType/theme enums — previously each of
// matchmaking.controller.js and invite.controller.js hardcoded their own
// separate copy of WRITING_TYPES; centralized here alongside the new THEMES
// list so the two never drift out of sync with the Collaboration model.
export const WRITING_TYPES = ['story', 'poem'];

// 'classic' is the default — no theme applied, today's existing behavior.
// The rest are chosen so "a ${theme} ${writingType}" always reads naturally
// ("a mystery story", "a horror poem"); deliberately excludes anything
// format-like (e.g. letters/epistolary), which belongs to the deferred
// structural-genre phase, not this flavor-only one.
export const THEMES = ['classic', 'mystery', 'horror', 'romance', 'sci-fi', 'fantasy'];
