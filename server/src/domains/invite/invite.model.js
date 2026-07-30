import mongoose from 'mongoose';
import { WRITING_TYPES, THEMES } from '../collaboration/collaboration.constants.js';

const inviteSchema = new mongoose.Schema(
  {
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    writingType: { type: String, enum: WRITING_TYPES, required: true },
    theme: { type: String, enum: THEMES, default: 'classic' },
    code: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['pending', 'redeemed', 'cancelled'],
      default: 'pending',
    },
    collaboration: { type: mongoose.Schema.Types.ObjectId, ref: 'Collaboration', default: null },
  },
  { timestamps: true }
);

export const Invite = mongoose.model('Invite', inviteSchema);
