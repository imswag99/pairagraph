import mongoose from 'mongoose';

// One entry per (user, collaboration) pair, created once when a collaboration
// completes. A ledger rather than a running total on User, so "this week" can
// be computed from createdAt instead of needing a separate reset job.
const pointsEntrySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  collaboration: { type: mongoose.Schema.Types.ObjectId, ref: 'Collaboration', required: true },
  points: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Guards against ever double-awarding the same completion, even if the
// service call site were somehow invoked twice.
pointsEntrySchema.index({ user: 1, collaboration: 1 }, { unique: true });
pointsEntrySchema.index({ user: 1, createdAt: 1 });

export const PointsEntry = mongoose.model('PointsEntry', pointsEntrySchema);
