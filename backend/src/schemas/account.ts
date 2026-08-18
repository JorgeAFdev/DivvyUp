import mongoose, { InferSchemaType } from 'mongoose';

// Read-only view of Better Auth's `user` collection, used only to hydrate the
// avatar onto Group.members[].user via .populate('members.user', 'name image').
// Better Auth owns writes to this collection (name, email, emailVerified, image);
// this model never writes it. `_id` stays the ObjectId Better Auth generates,
// so the ObjectId ref from members.user resolves. Its field is `image`; the
// contract exposes it as `profilePicture` (mapped in the serializer).
const accountSchema = new mongoose.Schema(
  {
    name: { type: String },
    image: { type: String },
  },
  { collection: 'user' },
);

export type AccountDoc = InferSchemaType<typeof accountSchema>;

const Account = mongoose.model('Account', accountSchema);

export default Account;
