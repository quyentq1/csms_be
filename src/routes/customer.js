const express = require('express');

const CustomerController = require('../controllers/CustomerController');
const jwtAuth = require('../midlewares/jwtAuth');

let router = express.Router();

router.post('/register', CustomerController.register);

router.post('/login', CustomerController.login);

router.post('/logout', CustomerController.logout);

router.post('/refresh', CustomerController.refreshAccessToken);

router.get('/infor', jwtAuth, CustomerController.getInfor);

router.put('/update', jwtAuth, CustomerController.update);

router.post('/googleLogin', CustomerController.googleLogin);


router.post('/forgotpass', CustomerController.forgotPassword);

router.post('/verifyOtp', CustomerController.verifyOtpController);

router.post('/resetPassword', CustomerController.resetPassword);

router.get('/totalUser', CustomerController.totalUser);

module.exports = router;
