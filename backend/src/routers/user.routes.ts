import express from "express";
import * as expensesController from "../controllers/expense.controller.js";
import upload from '../config/multer.config.js';
import { jwtMiddleware } from "../security/jwt.js";
import * as userController from "../controllers/user.controller.js";

const router = express.Router();

router.patch("/update", jwtMiddleware, upload.single('profilePicture'), userController.updateUser);
router.get("/expenses", jwtMiddleware, expensesController.getExpensesByUserId);


export default router;
