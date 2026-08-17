// Name normalization and the group-uniqueness check, shared by the group and
// invite controllers. Member names are unique within a group, compared
// lowercased. Body-shape validation lives in @monorepo/validation now; these
// stay because they are DB/business rules (uniqueness, storage form), not shape.
const cleanName = (name: unknown) => (typeof name === "string" ? name.trim() : "");

const hasDuplicateNames = (names: string[]) => {
  const normalized = names.map((name) => name.toLowerCase());
  return new Set(normalized).size !== normalized.length;
};

export { cleanName, hasDuplicateNames };
