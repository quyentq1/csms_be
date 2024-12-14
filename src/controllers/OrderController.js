const orderid = require('order-id')('key');
const User = require('../models/user');
const Order_State = require('../models/order_state');
const Product_Variant = require('../models/product_variant');
const Product = require('../models/product');
const Product_Price_History = require('../models/product_price_history');
const Order_Item = require('../models/order_item');
const Feedback = require('../models/feedback');
const Order_Status_Change_History = require('../models/order_status_change_history');
const Order = require('../models/order');
const Codediscount = require('../models/codediscount');
const Notification = require('../models/notification');
const Customer_Info = require('../models/customer_info');

let create = async (req, res, next) => {
    let user_id = req.token.customer_id;
    if (!user_id) return res.status(400).send({ message: 'Invalid Access Token' });
    try {
        let user = await User.findOne({ where: { user_id, role_id: 2 } });
        if (user == null) return res.status(400).send('User này not exists');
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
    let customer_name = req.body.customer_name;
    if (customer_name === undefined) return res.status(400).send(' customer_name not exists');
    let email = req.body.email;
    if (email === undefined) return res.status(400).send(' email not exists');
    let phone_number = req.body.phone_number;
    if (phone_number === undefined) return res.status(400).send(' phone_number not exists');
    let address = req.body.address;
    if (address === undefined) return res.status(400).send(' address not exists');
    let order_items = req.body.order_items;
    if (order_items === undefined) return res.status(400).send(' order_items not exists');
    let payment_method = req.body.payment_method;
    if (payment_method === undefined) return res.status(400).send(' paymentMethod not exists');
    let statusPayment = req.body.statusPayment; // Thông tin đã thanh toán hay chưa Process, Done
    if (statusPayment === undefined) statusPayment == 'Process'
    let shipping = req.body.shipping;
    if (shipping === undefined) shipping == 'J&T expreess'
    let delivery_charges = req.body.delivery_charges;
    if (delivery_charges === undefined) delivery_charges == 20000
    try {
        let order_id = orderid.generate().replace(/-/g, "");
        var newOrder = await Order.create({
            user_id,
            order_id,
            customer_name,
            email,
            phone_number,
            address,
            total_product_value: 0,
            delivery_charges: 0,
            total_order_value: 0,
            methodPayment: payment_method,
            statusPayment: statusPayment,
            shipping
        });

        let total_product_value = 0;
        for (let i = 0; i < order_items.length; i++) {
            let order_item = order_items[i];
            let product_variant = await Product_Variant.findOne({
                attributes: ['product_variant_id', 'quantity', 'state'],
                include: [
                    {
                        model: Product, attributes: ['product_id'],
                        include: { model: Product_Price_History, attributes: ['price'], separate: true, order: [['created_at', 'DESC']] }
                    },
                ],
                where: { product_variant_id: order_item.product_variant_id }
            });
            if (product_variant == null)
                return res.status(400).send("Product not exists");
            if (product_variant.state != true)
                return res.status(400).send("This product is not yet available for sale.");
            if (order_item.quantity > product_variant.quantity)
                return res.status(400).send("Invalid product quantity");
            let productVariantPrice = product_variant.Product.Product_Price_Histories[0].price;
            let total_value = productVariantPrice * order_item.quantity;
            let newOrderItem = {
                order_id: newOrder.order_id,
                product_variant_id: product_variant.product_variant_id,
                order_item_index: i,
                price: productVariantPrice,
                quantity: order_item.quantity,
                total_value
            }
            await Order_Item.create(newOrderItem);
            newProductVariantQuantity = product_variant.quantity - order_item.quantity;
            product_variant.update({ quantity: newProductVariantQuantity });
            total_product_value += total_value;
        }
        let total_order_value = total_product_value + delivery_charges;
        newOrder.update({ total_product_value, delivery_charges, total_order_value });
        let state = await Order_State.findOne({ where: { state_id: 1, state_name: "Waiting for Confirmation" } });
        await newOrder.addOrder_State(state);
        if(statusPayment == 'Process'){
            Notification.create({
                user_id,
                content: 'Order successfully placed #'+order_id
            });
        }else{
            Notification.create({
                user_id,
                content: 'Order paid successfully #'+order_id
            });
            const customer = await Customer_Info.findOne({ where: { user_id } });
            if (customer){
                const currentPoints = parseFloat(customer.point) || 0; 
                const updatedPoints = currentPoints + total_order_value * 0.01;
                await Customer_Info.update(
                    { point: updatedPoints },
                    { where: { user_id } }
                )
            }
        }
        return res.send(newOrder)
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
}

let listAdminSide = async (req, res, next) => {
    try {
        let orderList = await Order.findAll({
            attributes: ['order_id', 'total_order_value'],
            include: [
                {
                    model: Order_Status_Change_History, where: { state_id: 1 }
                },
            ],
            order: [
                [Order_Status_Change_History, 'created_at', 'DESC']
            ]
        });

        orderList = await Promise.all(orderList.map(async (order) => {
            let stateList = await order.getOrder_States()
            let state = stateList.pop()
            let newOrder = {
                order_id: order.order_id,
                total_order_value: order.total_order_value,
                state_id: state.state_id,
                state_name: state.state_name,
                created_at: order.Order_Status_Change_Histories[0].created_at
            }
            return newOrder;
        }));

        return res.send(orderList);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error loading data please try again');

    }
}

let listCustomerSide = async (req, res, next) => {
    let customer_id = req.token.customer_id;
    if (!customer_id) return res.status(400).send({ message: 'Invalid Access Token' });

    try {
        let customer = await User.findOne({ where: { user_id: customer_id, role_id: 2 } });
        if (customer == null) return res.status(400).send('User not exists');
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }

    try {
        // Lấy tất cả đơn hàng và sắp xếp theo ngày tạo
        let orderList = await Order.findAll({
            attributes: ['order_id', 'total_order_value', 'user_id'],
            include: [
                {
                    model: Order_Status_Change_History, where: { state_id: 1 }
                },
            ],
            where: { user_id: customer_id },
            order: [
                [Order_Status_Change_History, 'created_at', 'DESC']
            ]
        });

        orderList = await Promise.all(orderList.map(async (order) => {
            // Lấy danh sách sản phẩm của đơn hàng
            let productVariantList = await order.getProduct_variants();
            let orderItemList = [];
            for (let productVariant of productVariantList) {
                let product = await productVariant.getProduct();
                let productImages = await productVariant.getProduct_Images();
                let colour = await productVariant.getColour();
                let size = await productVariant.getSize();

                let feedback = await Feedback.findOne({
                    where: {
                        user_id: customer_id,
                        product_variant_id: productVariant.product_variant_id
                    }
                })
                let hasFeedback = feedback != null

                let productVariantConverted = {
                    product_variant_id: productVariant.product_variant_id,
                    name: product.product_name,
                    image: productImages[0].path,
                    quantity: productVariant.Order_Item.quantity,
                    colour: colour.colour_name,
                    size: size.size_name,
                    price: productVariant.Order_Item.price,
                    has_feedback: hasFeedback
                }
                orderItemList.push(productVariantConverted);
            }

            // Lấy trạng thái cuối cùng của đơn hàng
            let stateList = await order.getOrder_States()
            let state = stateList.pop()

            // Convert lại đơn hàng
            let orderConverted = {
                order_id: order.order_id,
                state_id: state.state_id,
                state_name: state.state_name,
                order_items: orderItemList,
                total_order_value: order.total_order_value,
                created_at: order.Order_Status_Change_Histories[0].created_at
            }
            return orderConverted;
        }));

        return res.send(orderList);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error loading data please try again');
        
    }
}

let listNotification = async (req, res, next) => {
    let customer_id = req.token.customer_id;
    if (!customer_id) return res.status(400).send({ message: 'Invalid Access Token' });

    try {
        let customer = await User.findOne({ where: { user_id: customer_id, role_id: 2 } });
        if (customer == null) return res.status(400).send('User này not exists');
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
    try {
        let notificationList = await Notification.findAll({
            attributes: ['id', 'user_id', 'content','created_at'],
            where: { user_id: customer_id, status: 0 },
            order: [
                ['created_at', 'DESC']
            ]
        });
        return res.send(notificationList);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error loading data please try again');
        
    }
}
let listNotificationAll = async (req, res, next) => {
    let customer_id = req.token.customer_id;
    if (!customer_id) return res.status(400).send({ message: 'Invalid Access Token' });

    try {
        let customer = await User.findOne({ where: { user_id: customer_id, role_id: 2 } });
        if (customer == null) return res.status(400).send('User not exists');
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
    try {
        let notificationList = await Notification.findAll({
            attributes: ['id', 'user_id', 'content','created_at'],
            where: { user_id: customer_id },
            order: [
                ['created_at', 'DESC']
            ]
        });
        return res.send(notificationList);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error loading data please try again');
        
    }
}
let changeStatusNotification = async (req, res, next) => {
    let id = req.params.id;
    if (id === undefined) return res.status(400).send(' id not exists');
    try {
        notifi = await Notification.findOne({ where: { id } });
        if(notifi){
            await Notification.update(
                { status: 1 },
                { where: { id: id } }
            )
            return res.send({ message: 'Update Success!' })
        }else{
            return res.status(400).send('Notification này not exists');
        }
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
}


let detailCustomerSide = async (req, res, next) => {
    let customer_id = req.token.customer_id;
    if (!customer_id) return res.status(400).send({ message: 'Invalid Access Token' });

    try {
        let customer = await User.findOne({ where: { user_id: customer_id, role_id: 2 } });
        if (customer == null) return res.status(400).send('User này not exists');
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error loading data please try again');
    }

    let order_id = req.params.order_id;
    if (order_id === undefined) return res.status(400).send(' order_id not exists');
    let order;
    try {
        order = await Order.findOne({ where: { order_id, user_id: customer_id } });
        if (order == null) return res.status(400).send('Order này not exists');
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error loading data please try again');
    }

    let stateList = await order.getOrder_States()
    let created_at = stateList[0].Order_Status_Change_History.created_at;
    let state = stateList.pop()

    let productVariantList = await order.getProduct_variants();
    let orderItemList = [];
    for (let productVariant of productVariantList) {
        let product = await productVariant.getProduct();
        let colour = await productVariant.getColour();
        let size = await productVariant.getSize();
        let productVariantConverted = {
            name: product.product_name,
            quantity: productVariant.Order_Item.quantity,
            price: productVariant.Order_Item.price,
            colour: colour.colour_name,
            size: size.size_name,
            total_value: productVariant.Order_Item.total_value
        }
        orderItemList.push(productVariantConverted);
    }

    let orderConverted = {
        order_id: order.order_id,
        state_id: state.state_id,
        state_name: state.state_name,
        created_at,
        order_items: orderItemList,
        total_product_value: order.total_product_value,
        delivery_charges: order.delivery_charges,
        total_order_value: order.total_order_value,
        customer_name: order.customer_name,
        email: order.email,
        phone_number: order.phone_number,
        address: order.address,
        methodPayment: order.methodPayment,
        shipping: order.shipping,
    }

    return res.send(orderConverted);
}


let checkDiscount = async (req, res, next) => {
    let code = req.params.code;
    if (code === undefined) return res.status(200).send({ status: 0, message: ' code not exists' });
    let discount;
    try {
        discount = await Codediscount.findOne({ where: { code, status: 0 } });
        if (discount == null) return res.status(200).send({ status: 0, message: 'Mã giảm giá này not exists' });
        discount.update({ status: 1 });
        return res.status(200).send({ status: 1, money:discount.money, message: 'Áp mã thành công' });
    } catch (err) {
        console.log(err);
        return res.status(400).send('Mã giảm giá not exists');
    }
}


let detailAdminSide = async (req, res, next) => {
    let order_id = req.params.order_id;
    if (order_id === undefined) return res.status(400).send(' order_id not exists');

    try {
        let order = await Order.findOne({ where: { order_id } });
        if (order == null) return res.status(400).send('Order này not exists');

        let stateList = await order.getOrder_States()
        let orderHistories = stateList.map((state) => {
            return {
                state_name: state.state_name,
                created_at: state.Order_Status_Change_History.created_at
            }
        });
        let created_at = stateList[0].Order_Status_Change_History.created_at
        let state = stateList.pop()

        let productVariantList = await order.getProduct_variants();
        let orderItemList = [];
        for (let productVariant of productVariantList) {
            let product = await productVariant.getProduct();
            let colour = await productVariant.getColour();
            let size = await productVariant.getSize();
            let productVariantConverted = {
                name: product.product_name,
                quantity: productVariant.Order_Item.quantity,
                price: productVariant.Order_Item.price,
                colour: colour.colour_name,
                size: size.size_name,
                total_value: productVariant.Order_Item.total_value
            }
            orderItemList.push(productVariantConverted);
        }

        let orderConverted = {
            order_id: order.order_id,
            state_id: state.state_id,
            state_name: state.state_name,
            created_at,
            order_items: orderItemList,
            total_product_value: order.total_product_value,
            delivery_charges: order.delivery_charges,
            total_order_value: order.total_order_value,
            methodpayment: order.methodPayment,
            shipping: order.shipping,
            order_histories: orderHistories,
            customer_name: order.customer_name,
            email: order.email,
            phone_number: order.phone_number,
            address: order.address
        }

        return res.send(orderConverted);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error loading data please try again');
    }
}

let changeStatus = async (req, res, next) => {
    let order_id = req.params.order_id;
    if (order_id === undefined) return res.status(400).send(' order_id not exist');
    let state_id = req.params.state_id;
    if (state_id === undefined) return res.status(400).send(' state_id not exist');
    let order;
    try {
        order = await Order.findOne({ where: { order_id } });
        if (order == null) return res.status(400).send('Order not exist');
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }

    try {
        // Xử lý chuyển đơn hàng sang trạng thái "Đã xác nhận"
        if (state_id == 2) {
            let stateList = await order.getOrder_Status_Change_Histories();
            const even = (state) => state.state_id == 1;
            // Kiểm tra xem đơn hàng có tồn tại trạng thái "Chờ xác nhận" hay không?
            if (stateList.some(even)) {
                let state = await Order_State.findOne({ where: { state_id: 2 } });
                let newState = await order.addOrder_State(state);
                // Update thông báo
                Notification.create({
                    user_id: order.user_id,
                    content: 'Order payment confirmed #'+order_id
                });
                const customer = await Customer_Info.findOne({ where: { user_id: order.user_id } });
                if (customer){
                    const currentPoints = parseFloat(customer.point) || 0; 
                    const updatedPoints = currentPoints + order.total_order_value * 0.01;
                    await Customer_Info.update(
                        { point: updatedPoints },
                        { where: { user_id: order.user_id } }
                    )
                }
                return res.send(newState);
            } else return res.send("Invalid order");
        }

        // Xử lý chuyển đơn hàng sang trạng thái "Đang vận chuyển"
        if (state_id == 3) {
            let stateList = await order.getOrder_Status_Change_Histories();
            const even = (state) => state.state_id == 2;
            // Kiểm tra xem đơn hàng có tồn tại trạng thái "Đã xác nhận" hay không?
            if (stateList.some(even)) {
                let state = await Order_State.findOne({ where: { state_id: 3 } });
                let newState = await order.addOrder_State(state);
                // Update thông báo
                Notification.create({
                    user_id: order.user_id,
                    content: 'Order is shipping #'+order_id
                });
                return res.send(newState);
            } else return res.send("Invalid order");
        }

        // Xử lý chuyển đơn hàng sang trạng thái "Đã giao"
        if (state_id == 4) {
            let stateList = await order.getOrder_Status_Change_Histories();
            const even = (state) => state.state_id == 3;
            // Kiểm tra xem đơn hàng có tồn tại trạng thái "Đang vận chuyển" hay không?
            if (stateList.some(even)) {
                let productVariantList = await order.getProduct_variants();
                for (let productVariant of productVariantList) {
                    let product = await productVariant.getProduct();
                    let oldSold = product.sold;
                    let quantity = productVariant.Order_Item.quantity;
                    let newSold = oldSold + quantity;
                    await product.update({ sold: newSold })
                }
                let state = await Order_State.findOne({ where: { state_id: 4 } });
                let newState = await order.addOrder_State(state);
                // Update thông báo
                Notification.create({
                    user_id: order.user_id,
                    content: 'Order delivered successfully #'+order_id
                });
                return res.send(newState);
            } else return res.send("Invalid order");
        }

        // Xử lý chuyển đơn hàng sang trạng thái "Đã hủy"
        if (state_id == 5) {
            let stateList = await order.getOrder_Status_Change_Histories();
            const even = (state) => state.state_id == 1;
            const lastIndex = stateList.length - 1;
            // Kiểm tra xem đơn hàng có tồn tại trạng thái "Chờ xác nhận" và 
            // không có trạng thái "Đã giao" và "Hủy bởi shop" là trạng thái cuối cùng hay không?
            if (stateList.some(even) && stateList[lastIndex].state_id != 4 && stateList[lastIndex].state_id != 6) {
                let state = await Order_State.findOne({ where: { state_id: 5 } });
                let newState = await order.addOrder_State(state);
                // Update thông báo
                Notification.create({
                    user_id: order.user_id,
                    content: 'Cancel order #'+order_id
                });
                return res.send(newState);
            } else return res.send("Invalid order");
        }

        // Xử lý chuyển đơn hàng sang trạng thái "Hủy bởi shop"
        if (state_id == 6) {
            let stateList = await order.getOrder_Status_Change_Histories();
            const even = (state) => state.state_id == 1;
            const lastIndex = stateList.length - 1;
            // Kiểm tra xem đơn hàng có tồn tại trạng thái "Chờ xác nhận" và 
            // không có trạng thái "Đã giao" và "Đã hủy" là trạng thái cuối cùng hay không?
            if (stateList.some(even) && stateList[lastIndex].state_id != 4 && stateList[lastIndex].state_id != 5) {
                let state = await Order_State.findOne({ where: { state_id: 6 } });
                let newState = await order.addOrder_State(state);
                // Update thông báo
                Notification.create({
                    user_id: order.user_id,
                    content: 'Shop cancel order #'+order_id
                });
                return res.send(newState);
            } else return res.send("Invalid order");
        }

        res.send("state_id invalid");
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error loading data please try again');
    }
}
let totalOrder = async (req, res, next) => {
    try {
        // Đếm số lượng order_id trong bảng Orders
        const totalOrderCount = await Order.count({
            distinct: true, // Đếm các giá trị duy nhất nếu cần
            col: 'order_id' // Cột để đếm
        });

        // Trả về kết quả
        return res.send({ totalOrder: totalOrderCount });
    } catch (error) {
        console.error('Error calculating total orders:', error);
        return res.status(500).send({ error: 'An error occurred while calculating the order total..' });
    }
};
let totalPrice = async (req, res, next) => {
    try {
        // Lấy tất cả các sản phẩm variant
        let Orders = await Order.findAll({
            attributes: ['total_order_value'] // Chỉ cần lấy thuộc tính quantity
        });

        // Tính tổng quantity
        let totalPrice = Orders.reduce((total, order_ss) => total + order_ss.total_order_value, 0);

        // Trả về kết quả
        return res.send({ totalPrice });
    } catch (error) {
        console.error('Error calculating total products:', error);
        return res.status(500).send({ error: 'An error occurred while calculating the products total..' });
    }
};
let totalOrderPerDay = async (req, res, next) => {
    try {
        let orderHistory = await Order_Status_Change_History.findAll({
            attributes: ['order_id', 'created_At'] 
        });
        let ordersPerDay = {};
        orderHistory.forEach(order => {
            let date = new Date(order.dataValues.created_At).toISOString().split('T')[0]; 
            if (!ordersPerDay[date]) {
                ordersPerDay[date] = new Set();
            }
            ordersPerDay[date].add(order.order_id);
        });
        let totalOrdersPerDay = {};
        for (let date in ordersPerDay) {
            totalOrdersPerDay[date] = ordersPerDay[date].size;
        }
        return res.send({ totalOrdersPerDay });
    } catch (error) {
        console.error('Error calculating total orders per day:', error);
        return res.status(500).send({ error: 'An error occurred while calculating the order total. theo từng ngày.' });
    }
};
let totalRevenuePerDay = async (req, res, next) => {
    try {
        let orderHistory = await Order_Status_Change_History.findAll({
            attributes: ['order_id', 'created_At']
        });

        let revenuePerDay = {};
        for (let order of orderHistory) {
            let date = new Date(order.dataValues.created_At).toISOString().split('T')[0];

            let relatedOrder = await Order.findOne({
                where: { order_id: order.order_id },
                attributes: ['total_order_value']
            });

            if (relatedOrder) {
                if (!revenuePerDay[date]) {
                    revenuePerDay[date] = 0;
                }
                revenuePerDay[date] += parseFloat(relatedOrder.total_order_value || 0); 
            }
        }
        return res.send({ totalRevenuePerDay: revenuePerDay });
    } catch (error) {
        console.error('Error calculating total revenue per day:', error);
        return res.status(500).send({ error: 'An error occurred while calculating total revenue by day..' });
    }
};


module.exports = {
    create,
    listAdminSide,
    listCustomerSide,
    detailCustomerSide,
    detailAdminSide,
    changeStatus,
    totalPrice,
    totalOrder,
    totalOrderPerDay,
    totalRevenuePerDay,
    checkDiscount,
    listNotification,
    changeStatusNotification,
    listNotificationAll
}