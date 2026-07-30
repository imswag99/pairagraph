import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    displayName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    authProvider: { type: String, enum: ['local', 'google'], required: true },
    googleId: { type: String, unique: true, sparse: true },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String },
    emailVerificationExpires: { type: Date },
    refreshTokenHash: { type: String, default: null },
    passwordResetTokenHash: { type: String },
    passwordResetExpires: { type: Date },
    isDeleted: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    blockedUsers: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    totalCompletions: { type: Number, default: 0 },
    storyCompletions: { type: Number, default: 0 },
    poemCompletions: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActiveDate: { type: Date, default: null },
    badges: { type: [String], default: [] },
    partners: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
