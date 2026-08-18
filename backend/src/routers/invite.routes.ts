import express from "express";
import { groupParamsSchema, joinSchema } from "@monorepo/validation";
import { requireSession } from "../security/requireSession.js";
import { validate } from "../middlewares/validate.js";
import * as inviteController from "../controllers/invite.controller.js";

const router = express.Router();

router.get("/invite/:inviteCode", inviteController.getInviteName);
router.get("/join/:inviteCode", requireSession, inviteController.getGroupByInviteCode);
router.post("/join/:inviteCode", requireSession, validate(joinSchema), inviteController.joinGroup);
router.post("/:groupId/invite-code/regenerate", requireSession, validate(groupParamsSchema, "params"), inviteController.regenerateInviteCode);

export default router;
