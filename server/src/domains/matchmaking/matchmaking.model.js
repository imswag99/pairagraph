import mongoose from 'mongoose';

const matchQueueEntrySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  writingType: { type: String, enum: ['story', 'poem'], required: true },
  createdAt: { type: Date, default: Date.now },
});

export const MatchQueueEntry = mongoose.model('MatchQueueEntry', matchQueueEntrySchema);
