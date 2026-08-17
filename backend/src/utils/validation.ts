// DB/business helpers left after body-shape validation moved to
// @monorepo/validation. hasDuplicateNames (group + invite controllers) enforces
// the case-insensitive uniqueness of member names within a group. cleanName
// only normalizes the creator's stored User name in createGroup — the one name
// no request schema trims; body names are trimmed by their Zod schema.
const cleanName = (name: unknown) => (typeof name === "string" ? name.trim() : "");

const hasDuplicateNames = (names: string[]) => {
  const normalized = names.map((name) => name.toLowerCase());
  return new Set(normalized).size !== normalized.length;
};

export { cleanName, hasDuplicateNames };
