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
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
