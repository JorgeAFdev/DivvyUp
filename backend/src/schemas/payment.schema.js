const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PaymentSchema = new Schema({
    group: {
        type: Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    },
    from: {
        type: Schema.Types.ObjectId,
        required: true
    },
    to: {
        type: Schema.Types.ObjectId,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'paid', 'cancelled'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['manual', 'platform'],
        default: 'manual'
    },
    paidAt: Date,
}, { timestamps: true });

const Payment = mongoose.model("Payment", PaymentSchema);
module.exports = Payment;
