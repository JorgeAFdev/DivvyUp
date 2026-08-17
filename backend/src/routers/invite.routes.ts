import express from "express";
import { groupParamsSchema, joinSchema } from "@monorepo/validation";
import { jwtMiddleware } from "../security/jwt.js";
import { validate } from "../middlewares/validate.js";
import * as inviteController from "../controllers/invite.controller.js";

const router = express.Router();

router.get("/invite/:inviteCode", inviteController.getInviteName);
router.get("/join/:inviteCode", jwtMiddleware, inviteController.getGroupByInviteCode);
router.post("/join/:inviteCode", jwtMiddleware, validate(joinSchema), inviteController.joinGroup);
router.post("/:groupId/invite-code/regenerate", jwtMiddleware, validate(groupParamsSchema, "params"), inviteController.regenerateInviteCode);

export default router;
