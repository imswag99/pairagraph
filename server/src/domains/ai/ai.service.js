import { GoogleGenerativeAI } from '@google/generative-ai';
import { FALLBACK_KEYWORDS } from './keywords.fallback.js';

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// Left at defaults, Gemini kept converging on the same handful of "safe"
// evocative words (ember, threshold, resonance...) across unrelated calls —
// a random angle per request gives it different context to draw from.
const PROMPT_ANGLES = [
  'a coastal town at dusk', 'a long-lost letter', 'an unexpected reunion',
  'a journey through unfamiliar terrain', 'a secret kept for years',
  'the changing of seasons', 'a strange and vivid dream', 'an old house full of memories',
  'a chance encounter with a stranger', 'a promise made under pressure',
  'the last day before everything changes', 'a small act of courage',
  'a market at first light', 'a storm rolling in over the hills',
  'an heirloom passed down through generations', 'a train platform at midnight',
  'a rivalry that turns into friendship', 'a city seen for the first time',
  'a quiet betrayal', 'the space between two people who used to be close',
  'a discovery buried underground', 'a festival in a small village',
  'an argument that reveals something true', 'a return to a childhood home',
];

function pickRandomAngle() {
  return PROMPT_ANGLES[Math.floor(Math.random() * PROMPT_ANGLES.length)];
}

function pickRandomFallback(writingType) {
  const pool = FALLBACK_KEYWORDS[writingType];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5);
}

function parseKeywords(text) {
  const words = text
    .split(/[\s,]+/)
    .map((w) => w.replace(/[^a-zA-Z-]/g, '').toLowerCase())
    .filter(Boolean);
  return words.length >= 5 ? words.slice(0, 5) : null;
}

export async function generateKeywords(writingType, theme = 'classic') {
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-flash-latest',
        generationConfig: { temperature: 1.3, topP: 0.98, topK: 64 },
      });
      // theme only flavors the prompt text — it never changes the fallback
      // pool below, which stays generic per writingType regardless of theme
      // (curating a themed pool for every theme x writingType combination
      // is real content work, disproportionate to this being the cheap phase).
      const themedType = theme !== 'classic' ? `${theme} ${writingType}` : writingType;
      const prompt = `Give exactly 5 single evocative English words, comma-separated, no numbering, to inspire two people collaboratively writing a ${themedType} together. Draw inspiration from this angle without naming it directly: ${pickRandomAngle()}. Avoid overused writing-prompt words like "ember", "threshold", "whisper", "echo", "labyrinth", or "resonance".`;
      const result = await model.generateContent(prompt);
      const parsed = parseKeywords(result.response.text());
      if (parsed) {
        return parsed;
      }
    } catch {
      // Gemini unavailable/quota exhausted/bad response — fall through to fallback pool.
    }
  }

  return pickRandomFallback(writingType);
}
