import type { Types } from 'mongoose';
import type { GroupDoc, GroupHydrated, GroupMember } from '../schemas/group.schema.js';

// What toObject() yields for a member: the persisted fields plus _id, and none
// of the Subdocument methods a real GroupMember carries.
type MemberPlain = GroupDoc['members'][number] & { _id: Types.ObjectId };

// What a linked member's account exposes. Never widen it without checking
// that the password hash is not in the projection.
const MEMBER_FIELDS = 'name profilePicture';

// Where a member id sits inside an expense, for hydrateMembers. `as const` so
// the entries stay literal and can be checked against the target's keys.
const MEMBER_PATHS = ['paidBy', 'participants.member'] as const;

// A hydratable path on T: a top-level key, or "arrayKey.subKey" one level in.
// A typo like "membr" is neither, so it fails to compile at the call site.
type MemberPath<T> = (keyof T & string) | `${keyof T & string}.${string}`;

// The member object hydrateMembers substitutes in — the plain toObject() shape.
type HydratedMember = MemberPlain | null;

// For an array key K, the subfields hydrated inside its elements: the S in every
// "K.S" path present in P.
type SubField<P extends string, K extends string> = P extends `${K}.${infer S}` ? S : never;

type HydratedElem<E, S extends string> = { [J in keyof E]: J extends S ? HydratedMember : E[J] };

// The result: a top-level id field named by P becomes a member; an array field
// with an "arrayKey.subKey" path has that subfield replaced inside each element.
type Hydrated<T, P extends string> = {
  [K in keyof T]: K extends P
    ? HydratedMember
    : T[K] extends readonly (infer E)[]
      ? [SubField<P, K & string>] extends [never]
        ? T[K]
        : HydratedElem<E, SubField<P, K & string>>[]
      : T[K];
};

// A member's `user` may be a raw ObjectId or a populated account document; this
// pulls the id out of either shape, so it is genuinely untyped input.
const idOf = (value: any) => (value && value._id ? value._id : value);

const toPlain = (doc: any) =>
  (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc);

const memberOf = (group: GroupHydrated, userId: unknown): GroupMember | undefined =>
  group.members.find((m) => m.user && idOf(m.user).toString() === String(userId));

const membersById = (group: GroupHydrated) =>
  new Map<string, MemberPlain>(group.members.map((m) => [m._id.toString(), toPlain(m)]));

// Replaces member ids with the member itself on the given paths, since populate
// cannot resolve a ref that points inside another document's subdocument array.
// A path is either a field ("paidBy") or one field inside an array of
// subdocuments ("participants.member"). The body is reflective (paths are
// dynamic strings), so it is `any` internally; the overloads carry the contract.
function hydrateMembers<T extends object, P extends MemberPath<T>>(
  group: GroupHydrated, target: T[], paths: readonly P[]
): Hydrated<T, P>[];
function hydrateMembers<T extends object, P extends MemberPath<T>>(
  group: GroupHydrated, target: T, paths: readonly P[]
): Hydrated<T, P>;
function hydrateMembers(group: GroupHydrated, target: any, paths: readonly string[]): any {
  const byId = membersById(group);
  const member = (id: any) => (id ? byId.get(id.toString()) ?? null : null);

  const hydrate = (doc: any) => {
    const plain = { ...toPlain(doc) };

    paths.forEach((path) => {
      const [field, subField] = path.split('.');

      if (subField) {
        plain[field] = (plain[field] ?? []).map((entry: any) => ({
          ...toPlain(entry),
          [subField]: member(entry[subField]),
        }));
        return;
      }

      plain[field] = member(plain[field]);
    });

    return plain;
  };

  return Array.isArray(target) ? target.map(hydrate) : hydrate(target);
}

const linkedUserIds = (group: GroupHydrated, memberIds: Types.ObjectId[]) =>
  group.members
    .filter((m) => m.user && memberIds.some((id) => m._id.equals(id)))
    .map((m) => idOf(m.user).toString());

export { MEMBER_FIELDS, MEMBER_PATHS, idOf, memberOf, membersById, hydrateMembers, linkedUserIds };
export type { Hydrated, MemberPath };
