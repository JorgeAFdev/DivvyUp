import express from "express";
import { expenseGroupParamsSchema, expenseParamsSchema, expenseSchema } from "@monorepo/validation";
import { requireSession } from "../security/requireSession.js";
import { validate } from "../middlewares/validate.js";
import * as expensesController from "../controllers/expense.controller.js";

const router = express.Router();

router.post("/:groupId/expenses", requireSession, validate(expenseGroupParamsSchema, "params"), validate(expenseSchema), expensesController.createExpense);
router.patch("/:groupId/expenses/:expenseId", requireSession, validate(expenseParamsSchema, "params"), validate(expenseSchema), expensesController.updateExpense);
router.get("/:groupId/expenses", requireSession, validate(expenseGroupParamsSchema, "params"), expensesController.getExpensesByGroupId);
router.delete("/:groupId/expenses/:expenseId", requireSession, validate(expenseParamsSchema, "params"), expensesController.deleteExpense);

export default router;
