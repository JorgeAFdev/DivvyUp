const express = require("express");
const { jwtMiddleware } = require("../security/jwt")
const paymentController = require("../controllers/payments.controller");

const router = express.Router();

router.patch("/:paymentId", jwtMiddleware, paymentController.pay);


module.exports = router;
