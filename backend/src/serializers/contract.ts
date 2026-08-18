// The response boundary: maps Mongoose documents (and the member-hydrated plain
// objects hydrateMembers yields) to the serialized `@monorepo/shared` contract,
// field by field. Ids become hex strings, dates ISO strings, and __v is dropped.
// Each controller returns res.json(serializeX(doc)), so a field the contract adds
// or the schema renames fails to compile here instead of drifting onto the wire.
import type {
  BalanceEntry,
  Group,
  GroupDetails,
  HydratedBalanceEntry,
  HydratedExpense,
  HydratedPayment,
  InviteInfo,
  Member,
  MemberAccount,
  PaymentMethod,
  PaymentStatus,
  SessionUser,
  UserExpensesGroup,
} from '@monorepo/shared';

type IdLike = { toString(): string };

// A member's `user` after .populate('members.user', MEMBER_FIELDS): the account
// document, or a bare ObjectId when it was never populated, or null. Only
// populated members reach these serializers; a bare id degrades to null rather
// than inventing an account without a name.
interface AccountInput {
  _id: IdLike;
  name: string;
  image?: string | null;
}
type MemberUser = AccountInput | IdLike | null | undefined;

interface MemberInput {
  _id: IdLike;
  name: string;
  user?: MemberUser;
}
type HydratedMemberInput = MemberInput | null | undefined;

interface BalanceInput {
  _id: IdLike;
  member: IdLike;
  amount: number;
}
interface HydratedBalanceInput {
  _id: IdLike;
  member: HydratedMemberInput;
  amount: number;
}

interface GroupInput {
  _id: IdLike;
  name: string;
  description?: string | null;
  inviteCode: string;
  members: MemberInput[];
  balance: BalanceInput[];
  createdAt: Date;
  updatedAt: Date;
}

interface ExpenseInput {
  _id: IdLike;
  description: string;
  totalAmount: number;
  group: IdLike;
  paidBy: HydratedMemberInput;
  participants: Array<{ _id: IdLike; member: HydratedMemberInput; amountOwed: number }>;
  createdAt: Date;
  updatedAt: Date;
}

interface PaymentInput {
  _id: IdLike;
  group: IdLike;
  from: HydratedMemberInput;
  to: HydratedMemberInput;
  amount: number;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserInput {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

const isAccount = (user: MemberUser): user is AccountInput =>
  user != null && typeof user === 'object' && 'name' in user;

// Better Auth's user field is `image`; the wire contract keeps exposing it as
// `profilePicture`, so the frontend avatar code is untouched by the auth swap.
const serializeAccount = (user: MemberUser): MemberAccount | null =>
  isAccount(user)
    ? { _id: user._id.toString(), name: user.name, profilePicture: user.image ?? '' }
    : null;

const serializeMember = (member: MemberInput): Member => ({
  _id: member._id.toString(),
  name: member.name,
  user: serializeAccount(member.user),
});

const serializeHydratedMember = (member: HydratedMemberInput): Member | null =>
  member ? serializeMember(member) : null;

const serializeBalanceEntry = (entry: BalanceInput): BalanceEntry => ({
  _id: entry._id.toString(),
  member: entry.member.toString(),
  amount: entry.amount,
});

const serializeHydratedBalanceEntry = (entry: HydratedBalanceInput): HydratedBalanceEntry => ({
  _id: entry._id.toString(),
  member: serializeHydratedMember(entry.member),
  amount: entry.amount,
});

const serializeGroup = (group: GroupInput): Group => ({
  _id: group._id.toString(),
  name: group.name,
  description: group.description ?? undefined,
  inviteCode: group.inviteCode,
  members: group.members.map(serializeMember),
  balance: group.balance.map(serializeBalanceEntry),
  createdAt: group.createdAt.toISOString(),
  updatedAt: group.updatedAt.toISOString(),
});

const serializeHydratedExpense = (expense: ExpenseInput): HydratedExpense => ({
  _id: expense._id.toString(),
  description: expense.description,
  totalAmount: expense.totalAmount,
  group: expense.group.toString(),
  paidBy: serializeHydratedMember(expense.paidBy),
  participants: expense.participants.map((participant) => ({
    _id: participant._id.toString(),
    member: serializeHydratedMember(participant.member),
    amountOwed: participant.amountOwed,
  })),
  createdAt: expense.createdAt.toISOString(),
  updatedAt: expense.updatedAt.toISOString(),
});

const serializeHydratedPayment = (payment: PaymentInput): HydratedPayment => ({
  _id: payment._id.toString(),
  group: payment.group.toString(),
  from: serializeHydratedMember(payment.from),
  to: serializeHydratedMember(payment.to),
  amount: payment.amount,
  status: payment.status,
  paymentMethod: payment.paymentMethod,
  paidAt: payment.paidAt ? payment.paidAt.toISOString() : undefined,
  createdAt: payment.createdAt.toISOString(),
  updatedAt: payment.updatedAt.toISOString(),
});

interface GroupDetailsInput {
  inviteCode: string;
  members: MemberInput[];
  expenses: ExpenseInput[];
  balance: HydratedBalanceInput[];
  debts: PaymentInput[];
}

const serializeGroupDetails = (details: GroupDetailsInput): GroupDetails => ({
  inviteCode: details.inviteCode,
  members: details.members.map(serializeMember),
  expenses: details.expenses.map(serializeHydratedExpense),
  balance: details.balance.map(serializeHydratedBalanceEntry),
  debts: details.debts.map(serializeHydratedPayment),
});

interface InviteInfoInput {
  _id: IdLike;
  name: string;
  description?: string | null;
  alreadyMember: boolean;
  members: Array<{ _id: IdLike; name: string }>;
}

const serializeInviteInfo = (info: InviteInfoInput): InviteInfo => ({
  _id: info._id.toString(),
  name: info.name,
  description: info.description ?? undefined,
  alreadyMember: info.alreadyMember,
  members: info.members.map((member) => ({ _id: member._id.toString(), name: member.name })),
});

interface UserExpensesGroupInput {
  groupId: IdLike;
  groupName: string;
  groupDescription?: string | null;
  members: MemberInput[];
  expenses: ExpenseInput[];
}

const serializeUserExpensesGroup = (entry: UserExpensesGroupInput): UserExpensesGroup => ({
  groupId: entry.groupId.toString(),
  groupName: entry.groupName,
  groupDescription: entry.groupDescription ?? undefined,
  members: entry.members.map(serializeMember),
  expenses: entry.expenses.map(serializeHydratedExpense),
});

const serializeSessionUser = (user: UserInput): SessionUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  profilePicture: user.image ?? '',
});

export {
  serializeGroup,
  serializeHydratedExpense,
  serializeHydratedPayment,
  serializeGroupDetails,
  serializeInviteInfo,
  serializeUserExpensesGroup,
  serializeSessionUser,
};
