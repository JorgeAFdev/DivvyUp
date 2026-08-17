import express from "express";
import { paymentParamsSchema } from "@monorepo/validation";
import { jwtMiddleware } from "../security/jwt.js";
import { validate } from "../middlewares/validate.js";
import * as paymentController from "../controllers/payments.controller.js";

const router = express.Router();

router.patch("/:paymentId", jwtMiddleware, validate(paymentParamsSchema, "params"), paymentController.pay);


export default router;
