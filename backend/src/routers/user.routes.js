const express = require("express");
const expensesController = require("../controllers/expense.controller");
const upload = require('../config/multer.config'); // Middleware de multer


const { jwtMiddleware } = require("../security/jwt");
const userController = require("../controllers/user.controller");

const router = express.Router();

router.patch("/update", jwtMiddleware, upload.single('profilePicture'), userController.updateUser);
router.get("/expenses", jwtMiddleware, expensesController.getExpensesByUserId);


module.exports = router;
