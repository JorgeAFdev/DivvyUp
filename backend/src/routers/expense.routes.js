import express from "express";
import { jwtMiddleware } from "../security/jwt.js";
import * as expensesController from "../controllers/expense.controller.js";

const router = express.Router();

router.post("/:groupId/expenses", jwtMiddleware, expensesController.createExpense);
router.patch("/:groupId/expenses/:expenseId", jwtMiddleware, expensesController.updateExpense);
router.get("/:groupId/expenses", jwtMiddleware, expensesController.getExpensesByGroupId);
router.delete("/:groupId/expenses/:expenseId", jwtMiddleware, expensesController.deleteExpense);

export default router;