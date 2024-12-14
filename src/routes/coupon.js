const express = require('express');

const CouponController = require('../controllers/CouponController');

let router = express.Router();

router.post('/create', CouponController.create);

router.get('/admin/list', CouponController.listAdminSide);

router.get('/customer', CouponController.listCustomer);

router.put('/on', CouponController.onStatus);

router.put('/off', CouponController.offStatus);

router.delete('/delete', CouponController.deleteCoupon);

router.put('/update', CouponController.update);

router.get('/admin/detail/:id', CouponController.detailAdminSide);

module.exports = router;
