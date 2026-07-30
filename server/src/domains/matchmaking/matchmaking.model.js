import mongoose from 'mongoose';
import { WRITING_TYPES, THEMES } from '../collaboration/collaboration.constants.js';

const matchQueueEntrySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  writingType: { type: String, enum: WRITING_TYPES, required: true },
  theme: { type: String, enum: THEMES, default: 'classic' },
  createdAt: { type: Date, default: Date.now },
});

export const MatchQueueEntry = mongoose.model('MatchQueueEntry', matchQueueEntrySchema);
