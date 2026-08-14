import express from "express";
import { jwtMiddleware } from "../security/jwt.js";
import * as inviteController from "../controllers/invite.controller.js";

const router = express.Router();

router.get("/invite/:inviteCode", inviteController.getInviteName);
router.get("/join/:inviteCode", jwtMiddleware, inviteController.getGroupByInviteCode);
router.post("/join/:inviteCode", jwtMiddleware, inviteController.joinGroup);
router.post("/:groupId/invite-code/regenerate", jwtMiddleware, inviteController.regenerateInviteCode);

export default router;
