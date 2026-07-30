import mongoose from 'mongoose';
import { WRITING_TYPES, THEMES } from './collaboration.constants.js';

const participantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    hasApproved: { type: Boolean, default: null },
    lastTurnNotifiedAt: { type: Date, default: null },
    hasConsentedToPublish: { type: Boolean, default: false },
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
    writingType: { type: String, enum: WRITING_TYPES, required: true },
    theme: { type: String, enum: THEMES, default: 'classic' },
    turnOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    entries: { type: [entrySchema], default: [] },
    keywords: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'private', 'left'],
      default: 'in_progress',
    },
    leftBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Collaboration = mongoose.model('Collaboration', collaborationSchema);
