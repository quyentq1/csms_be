const { Op } = require("sequelize");

const CustomerInfo = require('../models/customer_info');



let listAdminSide = async (req, res, next) => {
    let list = await CustomerInfo.findAll({
        attributes: ['customer_info_id', 'customer_name' , 'phone_number' , 'address' , 'point', 'user_id']
    });
    return res.send(list);
}

let deleteUser = async (req, res, next) => {
    let customer_info_id  = req.body.customer_info_id ;
    if (customer_info_id  === undefined) return res.status(400).send('customer_info_id  not exist');
    try {
        await CustomerInfo.destroy(
            { where: { customer_info_id : customer_info_id  } }
        )
        return res.send({ message: 'Delete Product Failed' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('Error');
    }
}

let update = async (req, res, next) => {
    let customer_info_id = parseInt(req.body.customer_info_id);
    if (customer_info_id === undefined) return res.status(400).send(' customer_info_id not exist');
    let customer_name = req.body.customer_name;
    if (customer_name === undefined) return res.status(400).send(' customer_name not existi');
    let phone_number = req.body.phone_number;
    if (phone_number === undefined) return res.status(400).send(' phone_number not existi');
    let address = req.body.address;
    if (address === undefined) return res.status(400).send(' address not existi');
    let point = parseInt(req.body.point);
    if (point === undefined) return res.status(400).send(' point not existi');
    try {
        await CustomerInfo.update(
            { address, phone_number, customer_name, point },
            { where: { customer_info_id: customer_info_id } }
        )
        return res.send({ message: 'Update success!' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('error');
    }
}

let detailAdminSide = async (req, res, next) => {
    let id = req.params.id;
    if (id === undefined) return res.status(400).send(' id not exist');
    try {
        let Detail = await CustomerInfo.findOne({
            attributes: ['customer_info_id', 'customer_name' , 'phone_number' , 'address' , 'point', 'user_id'],
            where: { customer_info_id : id },
        });
        if (Detail) {
            return res.send(Detail);
        } else {
            return res.status(400).send('Counpo not existi');
        }
    } catch (err) {
        console.log(err);
        return res.status(500).send('error');
    }
}


module.exports = {
    listAdminSide,
    deleteUser,
    update,
    detailAdminSide
};