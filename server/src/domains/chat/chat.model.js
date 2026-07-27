import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  collaboration: { type: mongoose.Schema.Types.ObjectId, ref: 'Collaboration', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

chatMessageSchema.index({ collaboration: 1, createdAt: 1 });

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
