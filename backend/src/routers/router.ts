import express from "express";
import userRoutes from "./user.routes.js";
import groupExpensesRouter from "./expense.routes.js";
import groupRoutes from "./group.routes.js";
import inviteRoutes from "./invite.routes.js";
import authRouter from "./auth.routes.js";
import paymentRoutes from "./payment.routes.js";

const router = express.Router();

router.use("/group", groupExpensesRouter);
router.use("/user", userRoutes);
// Before groupRoutes so /invite/:code and /join/:code resolve as literals, not
// as a /:groupId match.
router.use("/group", inviteRoutes);
router.use("/group", groupRoutes);
router.use('/auth', authRouter);
router.use('/payment', paymentRoutes);

export default router;
