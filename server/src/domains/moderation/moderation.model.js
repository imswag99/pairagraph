import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Optional: a gallery report isn't about one specific person the way a
    // participant report is — the piece was co-written, so there's no single
    // "other" to name. null for source: 'gallery', always set for 'participant'.
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null },
    collaboration: { type: mongoose.Schema.Types.ObjectId, ref: 'Collaboration', required: true },
    reason: {
      type: String,
      enum: ['harassment', 'spam', 'inappropriate_content', 'other'],
      required: true,
    },
    details: { type: String, trim: true, maxlength: 1000, default: '' },
    status: { type: String, enum: ['open', 'reviewed'], default: 'open' },
    source: { type: String, enum: ['participant', 'gallery'], default: 'participant' },
  },
  { timestamps: true }
);

// One report per (reporter, collaboration) — repeated "Report" clicks on the
// same collaboration are a no-op rather than a fresh notification each time.
reportSchema.index({ reporter: 1, collaboration: 1 }, { unique: true });

export const Report = mongoose.model('Report', reportSchema);
