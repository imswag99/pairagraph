import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    hasApproved: { type: Boolean, default: null },
  },
  { _id: false }
);

const entrySchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const collaborationSchema = new mongoose.Schema(
  {
    participants: {
      type: [participantSchema],
      required: true,
      validate: {
        validator: (value) => value.length === 2,
        message: 'A collaboration must have exactly two participants',
      },
    },
    writingType: { type: String, enum: ['story', 'poem'], required: true },
    turnOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    entries: { type: [entrySchema], default: [] },
    keywords: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'private', 'left'],
      default: 'in_progress',
    },
    leftBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const Collaboration = mongoose.model('Collaboration', collaborationSchema);
