import mongoose, { InferSchemaType } from 'mongoose';

// Read-only view over Better Auth's `user` collection, so members.user (an
// ObjectId ref) can .populate() a name and avatar. Better Auth owns every write
// here; this model only reads.
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
