import express from "express";
import { paymentParamsSchema } from "@monorepo/validation";
import { requireSession } from "../security/requireSession.js";
import { validate } from "../middlewares/validate.js";
import * as paymentController from "../controllers/payments.controller.js";

const router = express.Router();

router.patch("/:paymentId", requireSession, validate(paymentParamsSchema, "params"), paymentController.pay);


export default router;
