// What a linked member's account exposes. Never widen it without checking
// that the password hash is not in the projection.
const MEMBER_FIELDS = 'name profilePicture';

const idOf = (value) => (value && value._id ? value._id : value);

const toPlain = (doc) =>
  (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc);

const memberOf = (group, userId) =>
  group.members.find((m) => m.user && idOf(m.user).toString() === String(userId));

const membersById = (group) =>
  new Map(group.members.map((m) => [m._id.toString(), toPlain(m)]));

// Replaces member ids with the member itself on the given paths, since populate
// cannot resolve a ref that points inside another document's subdocument array.
// A path is either a field ("paidBy") or one field inside an array of
// subdocuments ("participants.member").
const hydrateMembers = (group, target, paths) => {
  const byId = membersById(group);
  const member = (id) => (id ? byId.get(id.toString()) ?? null : null);

  const hydrate = (doc) => {
    const plain = { ...toPlain(doc) };

    paths.forEach((path) => {
      const [field, subField] = path.split('.');

      if (subField) {
        plain[field] = (plain[field] ?? []).map((entry) => ({
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
};

const linkedUserIds = (group, memberIds) =>
  group.members
    .filter((m) => m.user && memberIds.some((id) => m._id.equals(id)))
    .map((m) => idOf(m.user).toString());

module.exports = { MEMBER_FIELDS, idOf, memberOf, membersById, hydrateMembers, linkedUserIds };
