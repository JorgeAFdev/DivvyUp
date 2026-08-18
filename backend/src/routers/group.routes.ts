import express from "express";
import { groupParamsSchema, groupSchema } from "@monorepo/validation";
import { requireSession } from "../security/requireSession.js";
import { validate } from "../middlewares/validate.js";
import * as groupController from "../controllers/group.controller.js";

const router = express.Router();

router.post("/", requireSession, validate(groupSchema), groupController.createGroup);
router.get("/user", requireSession, groupController.getUserGroups);
router.put("/:groupId", requireSession, validate(groupParamsSchema, "params"), validate(groupSchema), groupController.updateGroup);
router.delete("/:groupId", requireSession, validate(groupParamsSchema, "params"), groupController.deleteGroup);
router.get("/:groupId", requireSession, validate(groupParamsSchema, "params"), groupController.getGroupById);
router.get("/:groupId/groupDetails", requireSession, validate(groupParamsSchema, "params"), groupController.getGroupDetails);


export default router;
