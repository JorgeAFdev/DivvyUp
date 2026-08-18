import crypto from 'crypto';
import mongoose, { HydratedDocument, InferSchemaType, Model, Types } from 'mongoose';
// Side-effect import: registers the 'UserView' model so members.user's
// ref: 'UserView' resolves when .populate('members.user') runs.
import './userView.js';


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
          ref: 'UserView',
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

export type GroupDoc = InferSchemaType<typeof GroupSchema>;

// InferSchemaType returns the persisted shape but drops the _id (and subdocument
// methods) Mongoose gives every array element at runtime. Subdocument<ObjectId>
// adds them back, so member/balance elements are keyed and compared as documents.
export type GroupMember = Types.Subdocument<Types.ObjectId> & GroupDoc['members'][number];
export type BalanceEntry = Types.Subdocument<Types.ObjectId> & GroupDoc['balance'][number];

// The hydrated document the model hands back: members/balance are DocumentArrays
// of the subdocument types above (so .id(), .push() and element._id are typed).
export type GroupHydrated = Omit<HydratedDocument<GroupDoc>, 'members' | 'balance'> & {
  members: Types.DocumentArray<GroupMember>;
  balance: Types.DocumentArray<BalanceEntry>;
  createdAt: Date;
  updatedAt: Date;
};

interface GroupModel extends Model<GroupDoc, {}, {}, {}, GroupHydrated> {
  newInviteCode(): string;
}

GroupSchema.statics.newInviteCode = function () {
  return crypto.randomBytes(16).toString('base64url');
};

GroupSchema.pre('validate', function (next) {
  if (!this.inviteCode) {
    this.inviteCode = (this.constructor as GroupModel).newInviteCode();
  }
  next();
});

const Group = mongoose.model<GroupDoc, GroupModel>('Group', GroupSchema);
export default Group;
