const { Sequelize } = require('sequelize');
const Comment = require('../models/comments');
const User = require('../models/user');
const Product = require('../models/product');
const Customer_Info = require('../models/customer_info');

// Tạo mới một comment
let create = async (req, res, next) => {
    let user_id = req.token.customer_id;
    if (!user_id) return res.status(400).send({ message: 'Access Token Invalid' });
    let product_id = req.body.product_id;
    if (product_id === undefined) return res.status(400).send(' product_id Not Exists');
    let comment_text = req.body.comment_text;
    if (comment_text === undefined) return res.status(400).send(' comment_text Not Exists');
    let parent_id = req.body.parent_id || null;

    try {
        // Kiểm tra xem user có tồn tại không
        let user = await User.findOne({ where: { user_id } });
        if (!user) return res.status(400).send('User  Not Exists');

        // Kiểm tra xem product có tồn tại không
        let product = await Product.findOne({ where: { product_id } });
        if (!product) return res.status(400).send('Product  Not Exists');

        // Tạo mới comment
        let comment = await Comment.create({ product_id, user_id, comment_text, parent_id });
        return res.send(comment);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
}
let createReply = async (req, res, next) => {
    let user_id = req.token.customer_id;
    if (!user_id) return res.status(400).send({ message: 'Access Token Invalid' });
    
    let { commentId, content } = req.body;
    if (!commentId) return res.status(400).send(' commentId Not Exists');
    if (!content) return res.status(400).send(' content Not Exists');

    try {
        // Kiểm tra xem user có tồn tại không
        let user = await User.findOne({
            where: { user_id },
            include: [{ model: Customer_Info, attributes: ['customer_name'] }]
        });
        if (!user) return res.status(400).send('User  Not Exists');

        // Kiểm tra xem comment gốc có tồn tại không
        let parentComment = await Comment.findOne({ where: { id: commentId } });
        if (!parentComment) return res.status(400).send('Comment Not Exists');

        // Tạo reply mới
        let reply = await Comment.create({
            product_id: parentComment.product_id,
            user_id: user_id,
            comment_text: content,
            parent_id: commentId
        });

        // Format response data
        const responseData = {
            id: reply.id,
            user_name: user.Customer_Info.customer_name,
            comment_text: reply.comment_text,
            created_at: reply.created_at
        };

        return res.status(201).json({
            message: 'Reply created successfully',
            data: responseData
        });

    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
}
// Cập nhật một comment
let update = async (req, res, next) => {
    let comment_id = req.body.comment_id;
    if (comment_id === undefined) return res.status(400).send(' comment_id Not Exists');
    let comment_text = req.body.comment_text;
    if (comment_text === undefined) return res.status(400).send(' comment_text Not Exists');

    try {
        // Kiểm tra xem comment có tồn tại không
        let comment = await Comment.findOne({ where: { id: comment_id } });
        if (!comment) return res.status(400).send('Comment  Not Exists');

        // Cập nhật nội dung comment
        await comment.update({ comment_text });
        return res.send({ message: 'Update Comment Success!' });
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
}

// Lấy chi tiết một comment (có thể bao gồm danh sách trả lời nếu có)
let detail = async (req, res, next) => {
    let comment_id = req.params.comment_id;
    if (comment_id === undefined) return res.status(400).send(' comment_id Not Exists');

    try {
        let comment = await Comment.findOne({
            where: { id: comment_id },
            include: [
                {
                    model: User,
                    include: [{ model: Customer_Info, attributes: ['customer_name'] }]
                },
                {
                    model: Comment,
                    as: 'replies', // Gán alias để lấy danh sách trả lời nếu có
                    include: [
                        { model: User, include: [{ model: Customer_Info, attributes: ['customer_name'] }] }
                    ]
                }
            ]
        });

        if (!comment) return res.status(400).send('Comment  Not Exists');
        return res.send(comment);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
}
let getReplies = async (req, res, next) => {
    let commentId = req.params.commentId;
    if (commentId === undefined) return res.status(400).send(' commentId Not Exists');

    try {
        let comment = await Comment.findOne({
            where: { id: commentId },
            include: [
                {
                    model: Comment,
                    as: 'replies',
                    include: [
                        { 
                            model: User, 
                            include: [{ model: Customer_Info, attributes: ['customer_name'] }] 
                        }
                    ],
                    order: [['created_at', 'ASC']]
                }
            ]
        });

        if (!comment) return res.status(404).send('Comment  Not Exists');

        // Format dữ liệu trả về
        let formattedReplies = comment.replies.map(reply => ({
            id: reply.id,
            user_name: reply.User.Customer_Info.customer_name,
            comment_text: reply.comment_text,
            created_at: reply.created_at
        }));

        return res.json(formattedReplies);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
}
// Lấy danh sách các comment của một sản phẩm
let list = async (req, res, next) => {
    let product_id = req.params.product_id;
    if (product_id === undefined) return res.status(400).send(' product_id Not Exists');

    try {
        let product = await Product.findOne({ where: { product_id } });
        if (!product) return res.status(400).send('Product  Not Exists');

        let comments = await Comment.findAll({
            where: { product_id, parent_id: null }, // Chỉ lấy comment chính, không lấy trả lời
            include: [
                {
                    model: User,
                    include: [{ model: Customer_Info, attributes: ['customer_name'] }]
                },
                {
                    model: Comment,
                    as: 'replies', // Gán alias để lấy danh sách trả lời nếu có
                    include: [
                        { model: User, include: [{ model: Customer_Info, attributes: ['customer_name'] }] }
                    ]
                }
            ],
            order: [['created_at', 'DESC']]
        });

        comments = comments.map(comment => ({
            id: comment.id,
            user_name: comment.User.Customer_Info.customer_name,
            comment_text: comment.comment_text,
            created_at: comment.created_at,
            replies: comment.replies.map(reply => ({
                id: reply.id,
                user_name: reply.User.Customer_Info.customer_name,
                comment_text: reply.comment_text,
                created_at: reply.created_at
            }))
        }));

        return res.send(comments);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
}

// Xóa một comment
let deleteComment = async (req, res, next) => {
    let comment_id = req.params.comment_id;
    if (comment_id === undefined) return res.status(400).send(' comment_id Not Exists');

    try {
        let comment = await Comment.findOne({ where: { id: comment_id } });
        if (!comment) return res.status(400).send('Comment  Not Exists');

        // Xóa comment
        await comment.destroy();
        return res.send({ message: 'Deleted Comment Success!' });
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
}

module.exports = {
    create,
    update,
    detail,
    list,
    deleteComment,
    createReply,
    getReplies
}
