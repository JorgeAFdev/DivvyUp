import express from "express";
import { userUpdateSchema } from "@monorepo/validation";
import * as expensesController from "../controllers/expense.controller.js";
import upload from '../config/multer.config.js';
import { requireSession } from "../security/requireSession.js";
import { validate } from "../middlewares/validate.js";
import * as userController from "../controllers/user.controller.js";

const router = express.Router();

router.patch("/update", requireSession, upload.single('profilePicture'), validate(userUpdateSchema), userController.updateUser);
router.get("/expenses", requireSession, expensesController.getExpensesByUserId);


export default router;
