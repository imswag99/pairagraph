// Hand-authored fallback keyword pools, used whenever Gemini generation
// fails (quota exhausted, network error, missing key, bad response).
// Each list is deliberately larger than the 5 keywords ever drawn from it,
// so repeated fallbacks still feel varied.

export const FALLBACK_KEYWORDS = {
  story: [
    'lantern', 'journey', 'stranger', 'secret', 'threshold', 'storm', 'echo', 'ruins',
    'compass', 'shadow', 'harbor', 'wanderer', 'omen', 'crossroads', 'relic', 'vow',
    'exile', 'twilight', 'labyrinth', 'ember', 'tide', 'refuge', 'whisper', 'betrayal',
    'horizon', 'wilderness', 'courage', 'mask', 'prophecy', 'descent', 'ashes', 'sanctuary',
    'drift', 'pursuit', 'legacy', 'mercy', 'ambush', 'kingdom', 'veil', 'wreckage',
    'oath', 'hunger', 'mirage', 'silence', 'chase', 'deception', 'homecoming', 'fracture',
    'guardian', 'catalyst', 'ascent', 'phantom', 'tempest', 'inheritance', 'sacrifice', 'awakening',
    'verge', 'captive', 'wildfire', 'reckoning', 'nomad', 'citadel', 'drought', 'tremor',
    'insurgent', 'forge', 'quarry', 'sanctum', 'plague', 'migration', 'alliance', 'betrothal',
    'exodus', 'vigil', 'frontier', 'gambit', 'hollow', 'cipher', 'tribunal', 'siege',
    'pilgrimage', 'wraith', 'covenant', 'blight', 'mutiny', 'sentinel', 'chasm', 'rebellion',
    'harvest', 'glacier', 'foundling', 'usurper', 'catacomb', 'embargo', 'wanderlust', 'aftermath',
    'kinship', 'penance', 'reunion', 'undoing', 'vanguard', 'wildlands', 'voyage', 'castaway',
    'summit', 'abyss', 'keepsake', 'cavern', 'beacon', 'outlaw', 'bounty', 'currents',
    'quest', 'mosaic', 'crossfire', 'windfall', 'undertow', 'tidings', 'wayfarer', 'footprint',
  ],
  poem: [
    'petal', 'stillness', 'moonlight', 'tender', 'bloom', 'longing', 'dew', 'hush',
    'wander', 'ache', 'gossamer', 'solace', 'murmur', 'embers', 'fading', 'tide',
    'quiet', 'reverie', 'linger', 'threadbare', 'starlight', 'wistful', 'meadow', 'flicker',
    'sorrow', 'gentle', 'unfold', 'breath', 'hollow', 'grace', 'wilt', 'shimmer',
    'nostalgia', 'drift', 'velvet', 'threshold', 'lullaby', 'yearn', 'blossom', 'silhouette',
    'dusk', 'yearning', 'ripple', 'softly', 'whisper', 'fragile', 'glow', 'sigh',
    'meander', 'twilight', 'petrichor', 'solitude', 'cascade', 'delicate', 'hollowed', 'lantern',
    'unraveled', 'wistfulness', 'echo', 'unspoken', 'faded', 'tenderly', 'brittle', 'lulling',
    'evanescent', 'tenderness', 'wane', 'luminous', 'quietude', 'fleeting', 'stillborn', 'yearned',
    'hushed', 'cradle', 'fragment', 'weathered', 'threadlike', 'vapor', 'silvered', 'muted',
    'ashen', 'silken', 'unravel', 'homesick', 'tremble', 'afterglow', 'wilted', 'sundrenched',
    'weary', 'coalesce', 'hearthlight', 'undertone', 'lonesome', 'aftertaste', 'bittersweet', 'moonlit',
    'ephemeral', 'candor', 'reverent', 'fond', 'threaded', 'seaglass', 'driftwood', 'rainlight',
    'mellow', 'unbroken', 'weightless', 'daybreak', 'nightfall', 'windswept', 'fernlike', 'amber',
    'dovetail', 'earnest', 'tranquil', 'wavelength', 'softened', 'candlelit', 'faraway', 'starlit',
  ],
};
