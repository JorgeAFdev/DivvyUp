// The serialized API contract: the JSON shapes DivvyUp's endpoints send over the
// wire, not the backend's Mongoose types. Every id and date is a string here —
// ObjectId serializes to its hex string and Date to an ISO string through
// res.json — and Decimal amounts land as numbers. This is the single definition
// both the frontend (consumer) and the backend (which will type its responses
// against it) read, so it must describe what actually ships, not the documents.

/** A linked account, as populated onto a member with the `name profilePicture` projection. */
export interface MemberAccount {
  _id: string;
  name: string;
  profilePicture: string;
}

/**
 * A group member. The name belongs to the group; `user` is the linked account
 * (populated) or null when the member has no account and can still be claimed.
 */
export interface Member {
  _id: string;
  name: string;
  user: MemberAccount | null;
}

/** A member id resolved to the member itself by hydrateMembers, or null if it no longer resolves. */
export type HydratedMember = Member | null;

/** A member's net position in the group, keyed by member id. */
export interface BalanceEntry {
  _id: string;
  member: string;
  amount: number;
}

/** The same balance entry as the group-details endpoint returns it: member resolved. */
export interface HydratedBalanceEntry {
  _id: string;
  member: HydratedMember;
  amount: number;
}

/** A group as the raw endpoints return it (members.user populated). */
export interface Group {
  _id: string;
  name: string;
  description?: string;
  inviteCode: string;
  members: Member[];
  balance: BalanceEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseParticipant {
  _id: string;
  member: string;
  amountOwed: number;
}

/** An expense in its raw shape (paidBy and participant members are ids). */
export interface Expense {
  _id: string;
  description: string;
  totalAmount: number;
  group: string;
  paidBy: string;
  participants: ExpenseParticipant[];
  createdAt: string;
  updatedAt: string;
}

/** An expense as the endpoints return it: paidBy and each participant.member resolved to the member. */
export interface HydratedExpense {
  _id: string;
  description: string;
  totalAmount: number;
  group: string;
  paidBy: HydratedMember;
  participants: Array<{ _id: string; member: HydratedMember; amountOwed: number }>;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'cancelled';
export type PaymentMethod = 'manual' | 'platform';

/** A payment in its raw shape (from/to are member ids). A debt is a pending payment. */
export interface Payment {
  _id: string;
  group: string;
  from: string;
  to: string;
  amount: number;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** A payment/debt as the endpoints return it: from and to resolved to members. */
export interface HydratedPayment {
  _id: string;
  group: string;
  from: HydratedMember;
  to: HydratedMember;
  amount: number;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** GET /group/:groupId/details — the screen behind the group. */
export interface GroupDetails {
  inviteCode: string;
  members: Member[];
  expenses: HydratedExpense[];
  balance: HydratedBalanceEntry[];
  debts: HydratedPayment[];
}

/** GET /group/invite/:code — public, answers only the group name. */
export interface InviteName {
  name: string;
}

/** POST .../invite/regenerate — the fresh code. */
export interface InviteCode {
  inviteCode: string;
}

/** GET /group/join/:code — behind the token: the group and its unclaimed members. */
export interface InviteInfo {
  _id: string;
  name: string;
  description?: string;
  alreadyMember: boolean;
  members: Array<Pick<Member, '_id' | 'name'>>;
}

/** GET /expense/user — the user's expenses grouped by group. */
export interface UserExpensesGroup {
  groupId: string;
  groupName: string;
  groupDescription?: string;
  members: Member[];
  expenses: HydratedExpense[];
}

/** The account as register/login echo it back (id, no password). */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  profilePicture: string;
}
