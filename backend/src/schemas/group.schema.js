import crypto from 'crypto';
import mongoose from 'mongoose';


const GroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    members: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
      }],
    balance: [
      {
        member: { type: mongoose.Schema.Types.ObjectId, required: true },
        amount: {
          type: Number,
          default: 0
        }
      }
    ]
  },
  {
    timestamps: true,
  }
);

GroupSchema.statics.newInviteCode = function () {
  return crypto.randomBytes(16).toString('base64url');
};

GroupSchema.pre('validate', function (next) {
  if (!this.inviteCode) {
    this.inviteCode = this.constructor.newInviteCode();
  }
  next();
});

const Group = mongoose.model('Group', GroupSchema);
export default Group;
