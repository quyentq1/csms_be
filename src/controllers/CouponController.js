const { Op } = require("sequelize");

const Coupon = require('../models/codediscount');

let create = async (req, res, next) => {
    let code = req.body.code;
    if (code === undefined) return res.status(400).send('The code field does not exist.');
    let status = req.body.status;
    if (status === undefined) return res.status(400).send(' status not exists');
    let money = parseInt(req.body.money);
    if (money === undefined) return res.status(400).send(' money not exists');
    try {
        let newProduct = await Coupon.create({ code, status, money });
        return res.send(newProduct);
    } catch (e) {
        console.log(e);
        return res.status(500).send(e);
    }
}

let listAdminSide = async (req, res, next) => {
    let listCoupon = await Coupon.findAll({
        attributes: ['id','code', 'money', 'status', 'created_at'],
        order: [['created_at', 'DESC']]
    });
    return res.send(listCoupon);
}

let listCustomer = async (req, res, next) => {
    let whereClause = {};
    whereClause.status = 1;
    let listCoupon = await Coupon.findAll({
        attributes: ['id','code', 'money', 'status', 'created_at'],
        order: [['created_at', 'DESC']],
        where: whereClause
    });
    return res.send(listCoupon);
}

let onStatus = async (req, res, next) => {
    try {
        let id = req.body.id;
        if (id === undefined) return res.status(400).send(' id not exists');
        await Coupon.update(
            { status: 1 },
            { where: { id: id } }
        )
        return res.send({ message: 'Disable coupon success!' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('Error');
    }
}

let offStatus = async (req, res, next) => {
    try {
        let id = req.body.id;
        if (id === undefined) return res.status(400).send(' id not exists');
        await Coupon.update(
            { status: 0 },
            { where: { id: id } }
        )
        return res.send({ message: 'Active coupon success!' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('Error');
    }
}


let deleteCoupon = async (req, res, next) => {
    let id = req.body.id;
    if (id === undefined) return res.status(400).send(' id not exists');
    try {
        await Coupon.destroy(
            { where: { id: id } }
        )
        return res.send({ message: 'Delete Product Variant success' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('Error');
    }
}

let update = async (req, res, next) => {
        let id = parseInt(req.body.id);
        if (id === undefined) return res.status(400).send(' id not exists');
        let money = parseInt(req.body.money);
        if (money === undefined) return res.status(400).send(' money not exists');
        let code = req.body.code;
        if (code === undefined) return res.status(400).send(' code not exists');
        try {
            await Coupon.update(
                { money: money, code: code },
                { where: { id: id } }
            )
            return res.send({ message: 'Update success!' })
        } catch (err) {
            console.log(err)
            return res.status(500).send('Error');
        }
}

let detailAdminSide = async (req, res, next) => {
    let id = req.params.id;
    if (id === undefined) return res.status(400).send(' id not exists');

    try {
        let couponDetail = await Coupon.findOne({
            attributes: ['id', 'money', 'code' ],
            where: { id },
        });
        if (couponDetail) {
            return res.send(couponDetail);
        } else {
            return res.status(400).send('Counpo not exists');
        }
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
}

module.exports = {
    create,
    listAdminSide,
    listCustomer,
    onStatus,
    offStatus,
    deleteCoupon,
    update,
    detailAdminSide
};