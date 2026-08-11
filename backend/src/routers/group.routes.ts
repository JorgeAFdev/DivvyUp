import express from "express";
import { jwtMiddleware } from "../security/jwt.js";
import * as groupController from "../controllers/group.controller.js";

const router = express.Router();

router.post("/", jwtMiddleware, groupController.createGroup);
router.get("/user", jwtMiddleware, groupController.getUserGroups);
router.get("/invite/:inviteCode", groupController.getInviteName);
router.get("/join/:inviteCode", jwtMiddleware, groupController.getGroupByInviteCode);
router.post("/join/:inviteCode", jwtMiddleware, groupController.joinGroup);
router.post("/:groupId/invite-code/regenerate", jwtMiddleware, groupController.regenerateInviteCode);
router.put("/:groupId", jwtMiddleware, groupController.updateGroup);
router.delete("/:groupId", jwtMiddleware, groupController.deleteGroup);
router.get("/:groupId", jwtMiddleware, groupController.getGroupById);
router.get("/:groupId/groupDetails", jwtMiddleware, groupController.getGroupDetails);


export default router;
