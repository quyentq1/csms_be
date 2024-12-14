const express = require('express');

const UserController = require('../controllers/UserController');

let router = express.Router();

router.get('/admin/list', UserController.listAdminSide);

router.delete('/delete', UserController.deleteUser);

router.put('/update', UserController.update);

router.get('/admin/detail/:id', UserController.detailAdminSide);


module.exports = router;
