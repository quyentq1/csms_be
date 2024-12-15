const orderid = require('order-id')('key');
const { Sequelize } = require('sequelize');
const { Op } = require("sequelize");

const Order = require('../models/order');
const User = require('../models/user');
const Customer_Info = require('../models/customer_info');
const Order_State = require('../models/order_state');
const Product_Variant = require('../models/product_variant');
const Product = require('../models/product');
const Product_Price_History = require('../models/product_price_history');
const Order_Item = require('../models/order_item');
const Feedback = require('../models/feedback');
const Order_Status_Change_History = require('../models/order_status_change_history');
const Colour = require('../models/colour');
const Size = require('../models/size');
const axios = require('axios');

const predictFeedback = async (req, res, next) => {
    try {
        const feedbackArray = req.body;

        // Validate input
        if (!Array.isArray(feedbackArray)) {
            return res.status(400).send('Dữ liệu gửi lên phải là một mảng');
        }

        // Validate từng item trong array
        for (const item of feedbackArray) {
            if (!item.content || !item.feedback_id) {
                return res.status(400).send('Mỗi item phải có content và feedback_id');
            }
        }

        // Kiểm tra tất cả feedback có tồn tại không
        const feedbackIds = feedbackArray.map(item => item.feedback_id);
        const existingFeedbacks = await Feedback.findAll({
            where: {
                feedback_id: feedbackIds
            }
        });

        if (existingFeedbacks.length !== feedbackIds.length) {
            return res.status(404).send('Một số feedback không tồn tại');
        }

        // Chuẩn bị data để gọi API dự đoán
        const predictRequestBody = feedbackArray.map(item => ({
            id: item.feedback_id,
            comment: item.content,
            predict: null
        }));

        // Gọi API dự đoán
        const response = await axios.post('http://54.147.8.165:5000/api/v1/predict', predictRequestBody);

        if (response.data.status === 'successfuly' && response.data.data.length > 0) {
            // Update tất cả feedback với predict mới
            const updatePromises = response.data.data.map(result =>
                Feedback.update(
                    { predict: result.predict },
                    { where: { feedback_id: result.id } }
                )
            );

            await Promise.all(updatePromises);

            return res.json({
                message: 'Cập nhật predict thành công',
                data: response.data.data.map(result => ({
                    feedback_id: result.id,
                    content: feedbackArray.find(f => f.feedback_id === result.id)?.content,
                    predict: result.predict
                }))
            });
        } else {
            return res.status(500).send('Không nhận được kết quả dự đoán hợp lệ');
        }

    } catch (err) {
        console.log('Error in predictFeedback:', err);
        return res.status(500).send('Gặp lỗi khi xử lý dự đoán feedback');
    }
};

//Lấy feedback bằng search
const getFeedbacks = async (req, res, next) => {
    try {
        const page = parseInt(req.body.page) || 1;
        const limit = parseInt(req.body.limit) || 10;
        const search = req.body.search || '';
        const searchBy = req.body.searchBy || 'all';
        const startDate = req.body.startDate;
        const endDate = req.body.endDate;
        const predict = req.body.predict; // có thể là '0', '1' hoặc 'all'

        const offset = (page - 1) * limit;

        // Định nghĩa điều kiện tìm kiếm theo predict
        let predictCondition = {};
        if (predict === 0 || predict === 1) {
            predictCondition = { predict: predict };
        } else if (predict === null) {
            predictCondition = { predict: null };
        }
        // Nếu predict là 'all' hoặc undefined thì không thêm điều kiện
        console.log('predict:', predict); // kiểm tra giá trị của predict
        console.log('predictCondition:', predictCondition); // kiểm tra giá trị của predictCondition

        // Định nghĩa điều kiện tìm kiếm dựa vào searchBy
        let searchCondition;
        switch (searchBy) {
            case 'predict':
                searchCondition = [
                    { predict: { [Op.like]: `${search}` } }
                ];
                break;
            case 'content':
                searchCondition = [
                    { content: { [Op.like]: `%${search}%` } }
                ];
                break;
            case 'product':
                searchCondition = [
                    { '$product_variant.Product.product_name$': { [Op.like]: `%${search}%` } }
                ];
                break;
            case 'email':
                searchCondition = [
                    { '$User.email$': { [Op.like]: `%${search}%` } }
                ];
                break;
            default: // 'all'
                searchCondition = [
                    { predict: { [Op.like]: `${predict}` } },
                    { content: { [Op.like]: `%${search}%` } },
                    { '$product_variant.Product.product_name$': { [Op.like]: `%${search}%` } },
                    { '$User.email$': { [Op.like]: `%${search}%` } }
                ];
        }

        // Thêm điều kiện tìm kiếm theo ngày
        let dateCondition = {};
        if (startDate && endDate) {
            dateCondition = {
                created_at: {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                }
            };
        } else if (startDate) {
            dateCondition = {
                created_at: {
                    [Op.gte]: new Date(startDate)
                }
            };
        } else if (endDate) {
            dateCondition = {
                created_at: {
                    [Op.lte]: new Date(endDate)
                }
            };
        }

        const feedbacks = await Feedback.findAndCountAll({
            attributes: [
                'feedback_id',
                'content',
                'predict',
                'created_at'
            ],
            include: [
                {
                    model: Product_Variant,
                    attributes: ['product_id'],
                    as: 'product_variant',
                    include: [{
                        model: Product,
                        attributes: ['product_name'],
                        as: 'Product'
                    }]
                },
                {
                    model: User,
                    attributes: ['email'],
                    as: 'User'
                }
            ],
            where: {
                [Op.and]: [
                    { [Op.or]: searchCondition },
                    predictCondition,
                    dateCondition
                ]
            },
            offset: offset,
            limit: limit,
            order: [['created_at', 'ASC']]
        });

        return res.json({
            total: feedbacks.count,
            page: page,
            limit: limit,
            total_pages: Math.ceil(feedbacks.count / limit),
            searchBy: searchBy,
            predict: predict,
            startDate: startDate,
            endDate: endDate,
            data: feedbacks.rows
        });

    } catch (err) {
        console.log(err);
        return res.status(500).send('Gặp lỗi khi tải dữ liệu feedback, vui lòng thử lại');
    }
};

let create = async (req, res, next) => {
    let customer_id = req.token.customer_id;
    if (!customer_id) return res.status(400).send({ message: 'Invalid Access Token' });
    let product_variant_id = req.body.product_variant_id;
    if (product_variant_id === undefined) return res.status(400).send(' product_variant_id not exists');
    let rate = req.body.rate;
    if (rate === undefined) return res.status(400).send(' rate not exists');
    let content = req.body.content;
    if (content === undefined) return res.status(400).send(' content not exists');

    // Kiểm tra xem customer_id được gửi đến có tồn tại hay không?
    try {
        let customer = await User.findOne({ where: { user_id: customer_id, role_id: 2 } });
        if (customer == null) return res.status(400).send('Customer  not exists');
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }

    // Kiểm tra xem product_variant_id được gửi đến có tồn tại hay không?
    try {
        var productVariant = await Product_Variant.findOne({ where: { product_variant_id } });
        if (productVariant == null) return res.status(400).send('Product Variant  not exists');
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }

    // Kiểm tra xem feedback với customer_id và product_variant_id được gửi đến đã tồn tại hay chưa?
    try {
        let feedback = await Feedback.findOne({ where: { user_id: customer_id, product_variant_id } });
        if (feedback) return res.status(400).send('Feedback already exists');
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }

    try {
        // Kiểm tra xem customer có id tương ứng đã mua sản phẩn có product_variant_id đã gửi đến hay chưa?
        let order = await Order.findOne({
            attributes: ['order_id', 'total_order_value'],
            include: [
                {
                    model: Order_Item, where: { product_variant_id }
                },
                {
                    model: Order_Status_Change_History, where: { state_id: 4 }
                },
            ],
            where: { user_id: customer_id },
        });

        if (order) {
            let feedback = await Feedback.create({ user_id: customer_id, product_variant_id, rate, content });

            // Lấy tất cả Feedback có product tương ứng với feedback vừa tạo
            // tính rate trung bình và đếm số lượng
            let product = await productVariant.getProduct();
            let product_id = product.product_id;
            let [result] = await Feedback.findAll({
                attributes: [
                    [Sequelize.fn('avg', Sequelize.col('rate')), 'avg'],
                    [Sequelize.fn('count', Sequelize.col('rate')), 'count']
                ],
                include: { model: Product_Variant, where: { product_id } },
            });

            // Cập nhật lại Rating và feedbackQuantity cho product tương ứng
            let rating = parseFloat(result.dataValues.avg)
            let feedback_quantity = parseInt(result.dataValues.count)
            await product.update({ rating, feedback_quantity })

            return res.send(feedback);
        } else {
            return res.status(400).send('Invalid feedback');
        }
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
}

let update = async (req, res, next) => {
    let feedback_id = req.body.feedback_id;
    if (feedback_id === undefined) return res.status(400).send(' feedback_id not exists');
    let rate = req.body.rate;
    if (rate === undefined) return res.status(400).send(' rate not exists');
    let content = req.body.content;
    if (content === undefined) return res.status(400).send(' content not exists');

    try {
        let feedback = await Feedback.findOne({ where: { feedback_id } })
        if (!feedback) res.status(400).send('Feedback  not exists');
        else {
            await feedback.update({ rate, content })

            // Lấy tất cả Feedback có product tương ứng với feedback vừa tạo
            // tính rate trung bình
            let productVariant = await feedback.getProduct_variant();
            let product = await productVariant.getProduct();
            let product_id = product.product_id;
            let [result] = await Feedback.findAll({
                attributes: [
                    [Sequelize.fn('avg', Sequelize.col('rate')), 'avg'],
                ],
                include: { model: Product_Variant, where: { product_id } },
            });

            // Cập nhật lại Rating và feedbackQuantity cho product tương ứng
            let rating = parseFloat(result.dataValues.avg)
            await product.update({ rating })

            return res.send({ message: 'Feedback updated successfully!' })
        }
    } catch (err) {
        console.log(err)
        return res.status(500).send('Error');
    }
}

let detail = async (req, res, next) => {
    let customer_id = req.token.customer_id;
    if (!customer_id) return res.status(400).send({ message: 'Ivalid Access Token' });
    let product_variant_id = req.params.product_variant_id;
    if (product_variant_id === undefined) return res.status(400).send(' product_variant_id not exists');
    try {
        let customer = await User.findOne({ where: { user_id: customer_id, role_id: 2 } });
        if (customer == null) return res.status(400).send('Customer  not exists');
        let productVariant = await Product_Variant.findOne({ where: { product_variant_id } });
        if (productVariant == null) return res.status(400).send('Product Variant  not exists');

        let feedback = await Feedback.findOne({
            attributes: ['feedback_id', 'rate', 'content'],
            where: { user_id: customer_id, product_variant_id }
        })
        if (!feedback) res.status(400).send('Feedback  not exists');
        else return res.send(feedback)
    } catch (err) {
        console.log(err)
        return res.status(500).send('Error');
    }
}

let list = async (req, res, next) => {
    let product_id = req.params.product_id;
    if (product_id === undefined) return res.status(400).send(' product_id not exists');

    try {
        let product = await Product.findOne({ where: { product_id } })
        if (product == null) return res.status(400).send('Product  not exists')

        let feedbackList = await Feedback.findAll({
            attributes: ['rate', 'content', 'created_at'],
            include: [
                {
                    model: User,
                    include: [
                        { model: Customer_Info, attributes: ['customer_name'] }
                    ]
                },
                {
                    model: Product_Variant, where: { product_id },
                    include: [
                        { model: Colour, attributes: ['colour_name'] },
                        { model: Size, attributes: ['size_name'] },
                    ]
                },
            ],
            order: [['created_at', 'DESC']]
        });

        feedbackList = feedbackList.map((feedback) => {
            return {
                customer: feedback.User.Customer_Info.customer_name,
                rate: feedback.rate,
                colour: feedback.product_variant.Colour.colour_name,
                size: feedback.product_variant.Size.size_name,
                content: feedback.content,
                created_at: feedback.created_at
            }
        })

        return res.send(feedbackList)
    } catch (err) {
        console.log(err)
        return res.status(500).send('Error');
    }
}

module.exports = {
    create,
    update,
    detail,
    list,
    predictFeedback,
    getFeedbacks
}
