const express = require("express");
const { addDateMiddleware, validateUser } = require("../middlewares/index");
const expensesController = require("../controllers/expense.controller");
const upload = require('../config/multer.config'); // Middleware de multer


const { jwtMiddleware } = require("../security/jwt");
const userController = require("../controllers/user.controller");

const router = express.Router();
// Ruta para crear un usuario
router.post("/create", validateUser, userController.createUser);

// Ruta para obtener todos los usuarios
router.patch("/update",jwtMiddleware, upload.single('profilePicture'), userController.updateUser);
router.get("/", addDateMiddleware, userController.getAllUsers);
// current user
router.get("/me", addDateMiddleware, userController.getCurrentUser);
//eliminar
router.delete("/:id", addDateMiddleware, userController.deleteUser);
//actualizar
router.get("/expenses", jwtMiddleware, expensesController.getExpensesByUserId);
router.get("/:id", userController.getUserById);


module.exports = router;
