import express from "express";
import userRoutes from "./user.routes.js";
import groupExpensesRouter from "./expense.routes.js";
import groupRoutes from "./group.routes.js";
import authRouter from "./auth.routes.js";
import paymentRoutes from "./payment.routes.js";

const router = express.Router();

router.use("/group", groupExpensesRouter);
router.use("/user", userRoutes);
router.use("/group", groupRoutes);
router.use('/auth', authRouter);
router.use('/payment', paymentRoutes);

export default router;
