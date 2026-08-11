import mongoose, { HydratedDocument, InferSchemaType, Model, Types } from "mongoose";
import { updateBalance, generateDebts } from "../services/ledger.js";
import type { GroupHydrated } from "./group.schema.js";
const Schema = mongoose.Schema;

const ExpenseSchema = new Schema(
    {
        description: {
            type: String,
            required: true,
        },
        totalAmount: {
            type: Number,
            required: true,
        },
        group: {
            type: Schema.Types.ObjectId,
            ref: "Group",
            required: true,
        },
        paidBy: {
            type: Schema.Types.ObjectId,
            required: true,
        },
        participants: [
            {
                member: {
                    type: Schema.Types.ObjectId,
                    required: true,
                },
                amountOwed: {
                    type: Number,
                    required: true,
                },
            },
        ],
    },
    { timestamps: true },
);

export type ExpenseDoc = InferSchemaType<typeof ExpenseSchema>;

export type ExpenseParticipant = Types.Subdocument<Types.ObjectId> & ExpenseDoc['participants'][number];

export type ExpenseHydrated = Omit<HydratedDocument<ExpenseDoc>, 'participants'> & {
    participants: Types.DocumentArray<ExpenseParticipant>;
};

type ExpenseModel = Model<ExpenseDoc, {}, {}, {}, ExpenseHydrated>;

const updateGroupDetails = async function (expense: ExpenseHydrated) {
    const Group = mongoose.model('Group');
    const group = await Group.findById(expense.group) as GroupHydrated | null;
    // Loud on purpose: these hooks are the only thing keeping balances and debts
    // in sync, so a missing group must not pass as a silent no-op. Rejecting here
    // rejects the save()/findOneAndUpdate() that triggered it (see CLAUDE.md).
    if (!group) throw new Error(`updateGroupDetails: group ${expense.group} not found`);
    await updateBalance(group);
    await generateDebts(group);
};

ExpenseSchema.post('save', updateGroupDetails);
ExpenseSchema.post('findOneAndUpdate', updateGroupDetails);
ExpenseSchema.post('findOneAndDelete', updateGroupDetails);

const Expense = mongoose.model<ExpenseDoc, ExpenseModel>("Expense", ExpenseSchema);
export default Expense;