// Name normalization and the group-uniqueness check, shared by the group and
// invite controllers. Member names are unique within a group, compared
// lowercased. When TODO #11 lands the shared Zod schemas this is where the
// backend's validation layer grows.
const cleanName = (name: unknown) => (typeof name === "string" ? name.trim() : "");

const hasDuplicateNames = (names: string[]) => {
  const normalized = names.map((name) => name.toLowerCase());
  return new Set(normalized).size !== normalized.length;
};

export { cleanName, hasDuplicateNames };
