const express = require('express');

const AdminController = require('../controllers/AdminController');

let router = express.Router();

router.post('/register', AdminController.register);

router.post('/login', AdminController.login);

router.post('/2fa/generate', AdminController.generate2fa);

router.post('/2fa/verify', AdminController.verify2fa);

module.exports = router;
