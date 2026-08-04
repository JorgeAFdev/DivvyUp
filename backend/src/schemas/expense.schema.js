const mongoose = require("mongoose");
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

const updateGroupDetails = async function (expense) {
    const Group = mongoose.model('Group')
    const group = await Group.findById(expense.group);
    await group.updateBalance();
    await group.generateDebts();
};

ExpenseSchema.post('save', updateGroupDetails);
ExpenseSchema.post('findOneAndUpdate', updateGroupDetails);
ExpenseSchema.post('findOneAndDelete', updateGroupDetails);

const Expense = mongoose.model("Expense", ExpenseSchema);
module.exports = Expense;