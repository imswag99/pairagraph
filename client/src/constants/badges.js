// Single source of truth for badge display copy, shared between the
// Leaderboard's full badge gallery and the Homepage's progress teaser. Badge
// ids themselves are assigned server-side (auth.service.js) and are stable
// storage keys — only this display layer is safe to restyle freely.
export const BADGE_ORDER = [
  'first_completion',
  'ten_completions',
  'twentyfive_completions',
  'fifty_completions',
  'streak_3',
  'streak_7',
  'streak_14',
  'streak_30',
  'both_genres',
  'story_specialist',
  'poem_specialist',
  'social_butterfly',
  'marathon_writer',
];

export const BADGES = {
  first_completion: { label: 'Fresh Ink', description: 'Finish your first collaboration.' },
  ten_completions: { label: 'Prolific Pen', description: 'Finish 10 collaborations.' },
  twentyfive_completions: { label: 'Wordsmith', description: 'Finish 25 collaborations.' },
  fifty_completions: { label: 'Legendary Quill', description: 'Finish 50 collaborations.' },
  streak_3: { label: 'Warming Up', description: 'Complete a collaboration 3 days in a row.' },
  streak_7: { label: 'On a Roll', description: 'Complete a collaboration 7 days in a row.' },
  streak_14: { label: 'In the Zone', description: 'Complete a collaboration 14 days in a row.' },
  streak_30: { label: 'Unstoppable', description: 'Complete a collaboration 30 days in a row.' },
  both_genres: { label: 'Genre Bender', description: 'Finish at least one story and one poem.' },
  story_specialist: { label: 'Storyteller', description: 'Finish 10 stories.' },
  poem_specialist: { label: 'Poet Laureate', description: 'Finish 10 poems.' },
  social_butterfly: { label: 'Social Butterfly', description: 'Co-write with 5 different partners.' },
  marathon_writer: {
    label: 'Went the Distance',
    description: 'Contribute 15+ turns to a single collaboration.',
  },
};
