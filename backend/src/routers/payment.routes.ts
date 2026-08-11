import express from "express";
import { jwtMiddleware } from "../security/jwt.js";
import * as paymentController from "../controllers/payments.controller.js";

const router = express.Router();

router.patch("/:paymentId", jwtMiddleware, paymentController.pay);


export default router;
