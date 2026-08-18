import mongoose, { InferSchemaType } from 'mongoose';

// Read-only view of Better Auth's `user` collection, used only to hydrate the
// avatar onto Group.members[].user via .populate('members.user', 'name image').
// Named UserView, not Account: it reads the `user` collection, while Better
// Auth's separate `account` collection is the credential store. Better Auth owns
// writes here (name, email, emailVerified, image); this model never writes it.
// `_id` stays the ObjectId Better Auth generates, so the ObjectId ref from
// members.user resolves. Its field is `image`; the contract exposes it as
// `profilePicture` (mapped in the serializer).
const userViewSchema = new mongoose.Schema(
  {
    name: { type: String },
    image: { type: String },
  },
  { collection: 'user' },
);

export type UserViewDoc = InferSchemaType<typeof userViewSchema>;

const UserView = mongoose.model('UserView', userViewSchema);

export default UserView;
