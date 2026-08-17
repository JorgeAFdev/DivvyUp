import express from "express";
import { groupParamsSchema, groupSchema } from "@monorepo/validation";
import { jwtMiddleware } from "../security/jwt.js";
import { validate } from "../middlewares/validate.js";
import * as groupController from "../controllers/group.controller.js";

const router = express.Router();

router.post("/", jwtMiddleware, validate(groupSchema), groupController.createGroup);
router.get("/user", jwtMiddleware, groupController.getUserGroups);
router.put("/:groupId", jwtMiddleware, validate(groupParamsSchema, "params"), validate(groupSchema), groupController.updateGroup);
router.delete("/:groupId", jwtMiddleware, validate(groupParamsSchema, "params"), groupController.deleteGroup);
router.get("/:groupId", jwtMiddleware, validate(groupParamsSchema, "params"), groupController.getGroupById);
router.get("/:groupId/groupDetails", jwtMiddleware, validate(groupParamsSchema, "params"), groupController.getGroupDetails);


export default router;
