const { Op, fn, col,Sequelize } = require("sequelize");

const Product_Variant = require('../models/product_variant');
const Product = require('../models/product');
const Colour = require('../models/colour');
const Size = require('../models/size');
const Product_Price_History = require('../models/product_price_history');
const Product_Image = require('../models/product_image');
const Category = require("../models/category");
const Order = require('../models/order');
const Order_Status_Change_History = require('../models/order_status_change_history');

let create = async (req, res, next) => {
    let product_name = req.body.product_name;
    if (product_name === undefined) return res.status(400).send(' product_name not exist');
    let category_id = req.body.category_id;
    if (category_id === undefined) return res.status(400).send(' category_id not exist');
    let price = parseInt(req.body.price);
    if (price === undefined) return res.status(400).send(' price not exist');
    let description = req.body.description;
    if (description === undefined) return res.status(400).send(' description not exist');

    try {
        let newProduct = await Product.create({ product_name, description, category_id });
        let newProductPriceHistory = await Product_Price_History.create({
            product_id: newProduct.product_id,
            price: price
        });
        return res.send(newProduct);
    } catch (e) {
        console.log(e);
        return res.status(500).send(e);
    }
}

let update = async (req, res, next) => {
    let product_id = req.body.product_id;
    if (product_id === undefined) return res.status(400).send(' product_id not exist');
    let product_name = req.body.product_name;
    if (product_name === undefined) return res.status(400).send(' product_name not exist');
    let category_id = req.body.category_id;
    if (category_id === undefined) return res.status(400).send(' category_id not exist');
    let price = parseInt(req.body.price);
    if (price === undefined) return res.status(400).send(' price not exist');
    let description = req.body.description;
    if (description === undefined) return res.status(400).send(' description not exist');
    try {
        let category = await Category.findOne({ where: { category_id } });
        if (category == null) return res.status(400).send('Category not exist');
        let product = await Product.findOne({ where: { product_id } });
        if (product == null) return res.status(400).send('Product not exist');

        await Product_Price_History.create({ product_id, price })
        await product.update({ product_name, category_id, description })

        return res.send("Success")
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
}

let listAdminSide = async (req, res, next) => {
    let listProductVariant = await Product_Variant.findAll({
        attributes: ['product_variant_id', 'quantity', 'state', 'created_at'],
        include: [
            {
                model: Product, attributes: ['product_id', 'product_name'],
                include: { model: Product_Price_History, attributes: ['price'], separate: true, order: [['created_at', 'DESC']] }
            },
            { model: Colour, attributes: ['colour_name'] },
            { model: Size, attributes: ['size_name'] },
            { model: Product_Image, attributes: ['path'] },
        ],
        order: [['created_at', 'DESC']]
    });
    listProductVariant = listProductVariant.map((productVariant) => {
        let newProductVariant = {
            product_id: productVariant.Product.product_id,
            product_variant_id: productVariant.product_variant_id,
            product_name: productVariant.Product.product_name,
            colour_name: productVariant.Colour.colour_name,
            size_name: productVariant.Size.size_name,
            product_image: productVariant.Product_Images[0].path,
            price: productVariant.Product.Product_Price_Histories[0].price,
            quantity: productVariant.quantity,
            state: productVariant.state,
            created_at: productVariant.created_at
        }
        return newProductVariant;
    });
    return res.send(listProductVariant);
}

let listCustomerSide = async (req, res, next) => {
    let category_id = Number(req.query.category);
    let whereClause;
    if (category_id != undefined && Number.isInteger(category_id))
        whereClause = { category_id }
     try {
        // Lấy tất cả đơn hàng và sắp xếp theo ngày tạo
        const specificMonth = new Date().toISOString().split('T')[0];
        const startOfMonth = `${specificMonth}-01 00:00:00`;
        const endOfMonth = new Date(specificMonth); 
        endOfMonth.setMonth(endOfMonth.getMonth() + 1); 
        endOfMonth.setDate(0);
        endOfMonth.setHours(23, 59, 59, 999);
        const endOfMonthString = endOfMonth.toISOString().split('T')[0] + ' 23:59:59';
        let orderList = await Order.findAll({
            attributes: ['order_id', 'total_order_value'],
            include: [
                {
                    model: Order_Status_Change_History,
                    where: {
                        state_id: 4,
                        [Op.and]: [
                            Sequelize.where(fn('DATE', col('Order_Status_Change_Histories.created_at')), {
                                [Op.between]: [startOfMonth, endOfMonthString]
                            }),
                        ],
                    },
                },
            ],
            order: [[{ model: Order_Status_Change_History }, 'created_at', 'DESC']],
        });
        orderList = await Promise.all(orderList.map(async (order) => {
            // Lấy danh sách sản phẩm của đơn hàng
            let productVariantList = await order.getProduct_variants();
            let orderItemList = [];
            for (let productVariant of productVariantList) {
                let product = await productVariant.getProduct();
                if (!orderItemList.includes(product.product_id)) {
                    orderItemList.push(product.product_id);
                }
            }
            return orderItemList;
        }));
        // return res.send(orderList);
        let listProduct = await Product.findAll({
            attributes: ['product_id'],
            where: whereClause,
            group: ['product_id'],
            order: [['sold', 'DESC']],
            raw: true
        });
        const orderIds = orderList.flat()
        let listProductVariant = [];
        for (let { product_id } of listProduct) {
            // Lấy biến thể đầu tiên cho mỗi màu của sản phẩm
            let variants = await Product_Variant.findAll({
                attributes: ['product_variant_id', 'colour_id'],
                include: [
                    {
                        model: Product,
                        attributes: ['product_id', 'product_name', 'rating', 'sold', 'feedback_quantity'],
                        include: {
                            model: Product_Price_History,
                            attributes: ['price'],
                            separate: true,
                            order: [['created_at', 'DESC']],
                            limit: 1
                        }
                    },
                    { model: Colour, attributes: ['colour_name'] },
                    { model: Size, attributes: ['size_name'] },
                    { model: Product_Image, attributes: ['path'] }
                ],
                where: {
                    product_id,
                    state: true,
                    quantity: { [Op.gt]: 0 }
                },
                group: ['colour_id'], // Nhóm theo màu sắc
                raw: false
            });

            // Xử lý từng biến thể
            for (let variant of variants) {
                // Lấy tất cả size có sẵn cho màu này
                let sizes = await Product_Variant.findAll({
                    attributes: [],
                    include: [{
                        model: Size,
                        attributes: ['size_name']
                    }],
                    where: {
                        product_id,
                        colour_id: variant.colour_id,
                        state: true,
                        quantity: { [Op.gt]: 0 }
                    },
                    raw: true
                });

                let productVariant = {
                    product_id: variant.Product.product_id,
                    product_name: variant.Product.product_name,
                    rating: variant.Product.rating,
                    sold: variant.Product.sold,
                    feedback_quantity: variant.Product.feedback_quantity,
                    product_variant_id: variant.product_variant_id,
                    colour_id: variant.colour_id,
                    colour_name: variant.Colour.colour_name,
                    price: variant.Product.Product_Price_Histories[0]?.price,
                    product_image: variant.Product_Images[0]?.path,
                    sizes: sizes.map(size => size['Size.size_name'])
                };
                if(orderIds.includes(variant.Product.product_id)){
                    listProductVariant.unshift(productVariant);
                }else{
                    listProductVariant.push(productVariant);
                }
            }
        }
        return res.send(listProductVariant);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error loading data please try again');
        
    }
    // try {
    //     // Lấy danh sách sản phẩm độc nhất
    //     let listProduct = await Product.findAll({
    //         attributes: ['product_id'],
    //         where: whereClause,
    //         group: ['product_id'],
    //         order: [['created_at', 'DESC']],
    //         raw: true
    //     });

    //     let listProductVariant = [];

    //     for (let { product_id } of listProduct) {
    //         // Lấy biến thể đầu tiên cho mỗi màu của sản phẩm
    //         let variants = await Product_Variant.findAll({
    //             attributes: ['product_variant_id', 'colour_id'],
    //             include: [
    //                 {
    //                     model: Product,
    //                     attributes: ['product_id', 'product_name', 'rating', 'sold', 'feedback_quantity'],
    //                     include: {
    //                         model: Product_Price_History,
    //                         attributes: ['price'],
    //                         separate: true,
    //                         order: [['created_at', 'DESC']],
    //                         limit: 1
    //                     }
    //                 },
    //                 { model: Colour, attributes: ['colour_name'] },
    //                 { model: Size, attributes: ['size_name'] },
    //                 { model: Product_Image, attributes: ['path'] }
    //             ],
    //             where: {
    //                 product_id,
    //                 state: true,
    //                 quantity: { [Op.gt]: 0 }
    //             },
    //             group: ['colour_id'], // Nhóm theo màu sắc
    //             raw: false
    //         });

    //         // Xử lý từng biến thể
    //         for (let variant of variants) {
    //             // Lấy tất cả size có sẵn cho màu này
    //             let sizes = await Product_Variant.findAll({
    //                 attributes: [],
    //                 include: [{
    //                     model: Size,
    //                     attributes: ['size_name']
    //                 }],
    //                 where: {
    //                     product_id,
    //                     colour_id: variant.colour_id,
    //                     state: true,
    //                     quantity: { [Op.gt]: 0 }
    //                 },
    //                 raw: true
    //             });

    //             let productVariant = {
    //                 product_id: variant.Product.product_id,
    //                 product_name: variant.Product.product_name,
    //                 rating: variant.Product.rating,
    //                 sold: variant.Product.sold,
    //                 feedback_quantity: variant.Product.feedback_quantity,
    //                 product_variant_id: variant.product_variant_id,
    //                 colour_id: variant.colour_id,
    //                 colour_name: variant.Colour.colour_name,
    //                 price: variant.Product.Product_Price_Histories[0]?.price,
    //                 product_image: variant.Product_Images[0]?.path,
    //                 sizes: sizes.map(size => size['Size.size_name'])
    //             };

    //             listProductVariant.push(productVariant);
    //         }
    //     }

    //     return res.send(listProductVariant);
    // } catch (err) {
    //     console.log(err);
    //     return res.status(500).send('Error');
    // }
}

let listCustomerSearch = async (req, res, next) => {
    let product_name = req.params.product_name || ''; 
    let whereClause = {};
    if (product_name) {
        whereClause.product_name = { [Op.like]: `%${product_name}%` };
    }
    
    try {
        let listProduct = await Product.findAll({
            attributes: ['product_id'],
            where: whereClause,
            group: ['product_id'],
            order: [['created_at', 'DESC']],
            raw: true
        });

        let listProductVariant = [];
        for (let { product_id } of listProduct) {
            // Query để lấy các màu sắc riêng biệt
            let listColor = await Product_Variant.findAll({
                attributes: ['colour_id'],
                where: { 
                    product_id,
                    state: true,
                    quantity: { [Op.gt]: 0 }
                },
                group: ['colour_id'],
                raw: true
            });

            for (let { colour_id } of listColor) {
                // Query chính để lấy thông tin sản phẩm
                let productVariantInfo = await Product_Variant.findOne({
                    attributes: ['product_variant_id', 'colour_id'],
                    include: [
                        {
                            model: Product,
                            attributes: ['product_id', 'product_name', 'rating', 'sold', 'feedback_quantity'],
                            include: {
                                model: Product_Price_History,
                                attributes: ['price'],
                                limit: 1,
                                order: [['created_at', 'DESC']]
                            },
                            where: whereClause
                        },
                        { model: Colour, attributes: ['colour_name'] },
                        { 
                            model: Product_Image, 
                            attributes: ['path'],
                            limit: 1 
                        }
                    ],
                    where: {
                        colour_id,
                        product_id,
                        state: true,
                        quantity: { [Op.gt]: 0 }
                    }
                });

                if (productVariantInfo) {
                    // Query riêng để lấy danh sách size
                    let sizes = await Product_Variant.findAll({
                        attributes: [],
                        include: [{
                            model: Size,
                            attributes: ['size_name']
                        }],
                        where: {
                            product_id,
                            colour_id,
                            state: true,
                            quantity: { [Op.gt]: 0 }
                        },
                        raw: true
                    });

                    let productVariant = {
                        product_id: productVariantInfo.Product.product_id,
                        product_name: productVariantInfo.Product.product_name,
                        rating: productVariantInfo.Product.rating,
                        sold: productVariantInfo.Product.sold,
                        feedback_quantity: productVariantInfo.Product.feedback_quantity,
                        product_variant_id: productVariantInfo.product_variant_id,
                        colour_id: productVariantInfo.colour_id,
                        colour_name: productVariantInfo.Colour.colour_name,
                        price: productVariantInfo.Product.Product_Price_Histories[0]?.price,
                        product_image: productVariantInfo.Product_Images[0]?.path,
                        sizes: sizes.map(size => size['Size.size_name'])
                    };
                    
                    listProductVariant.push(productVariant);
                }
            }
        }
        
        return res.send(listProductVariant);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
}

let detailCustomerSide = async (req, res, next) => {
    let product_id = req.params.product_id;
    if (product_id === undefined) return res.status(400).send(' product_id not exist');

    try {
        let productDetail = await Product.findOne({
            attributes: ['product_id', 'product_name', 'description', 'rating', 'sold', 'feedback_quantity'],
            where: { product_id },
            raw: true
        });
        return res.send(productDetail);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
}

let detailAdminSide = async (req, res, next) => {
    let product_id = req.params.product_id;
    if (product_id === undefined) return res.status(400).send(' product_id not exist');

    try {
        let productDetail = await Product.findOne({
            attributes: ['product_id', 'product_name', 'category_id', 'description'],
            include: [
                { model: Category, attributes: ['title'] },
                { model: Product_Price_History, attributes: ['price'], separate: true, order: [['created_at', 'DESC']] },
                {
                    model: Product_Variant, attributes: ['product_variant_id', 'colour_id', 'size_id', 'quantity'],
                    include: [
                        { model: Colour, attributes: ['colour_name'] },
                        { model: Size, attributes: ['size_name'] },
                        { model: Product_Image, attributes: ['path'] }
                    ]
                }
            ],
            where: { product_id },
        });

        if (productDetail) {
            let productVariantList = productDetail.product_variants.map((productVariant) => {
                let productImages = productVariant.Product_Images.map(({ path }) => { return { path } })
                return {
                    product_variant_id: productVariant.product_variant_id,
                    colour_id: productVariant.colour_id,
                    colour_name: productVariant.Colour.colour_name,
                    size_id: productVariant.size_id,
                    size_name: productVariant.Size.size_name,
                    quantity: productVariant.quantity,
                    product_images: productImages
                }
            })
            productDetail = {
                product_id: productDetail.product_id,
                product_name: productDetail.product_name,
                category_id: productDetail.category_id,
                category_name: productDetail.Category.title,
                price: productDetail.Product_Price_Histories[0].price,
                description: productDetail.description,
                product_variant_list: productVariantList
            }
            return res.send(productDetail);
        } else {
            return res.status(400).send('Product Variant not exist');
        }
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
}

let listColour = async (req, res, next) => {
    let product_id = req.params.product_id;
    if (product_id === undefined) return res.status(400).send(' product_id not exist');

    try {
        let listColour = await Product_Variant.findAll({
            attributes: ['colour_id'],
            include: [
                { model: Colour, attributes: ['colour_name'] },
            ],
            where: { product_id },
            group: ['colour_id'],
        });

        listColour = listColour.map((colour) => {
            let newColour = {
                colour_id: colour.colour_id,
                colour_name: colour.Colour.colour_name
            }
            return newColour;
        });

        return res.send(listColour);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
}

let listSize = async (req, res, next) => {
    let product_id = req.params.product_id;
    if (product_id === undefined) return res.status(400).send(' product_id not exist');
    let colour_id = req.params.colour_id;
    if (colour_id === undefined) return res.status(400).send(' colour_id not exist');

    try {
        let listSize = await Product_Variant.findAll({
            attributes: ['size_id'],
            include: [
                { model: Size, attributes: ['size_name'] },
            ],
            where: { product_id, colour_id, state: true },
        });

        listSize = listSize.map((size) => {
            let newSize = {
                size_id: size.size_id,
                size_name: size.Size.size_name
            }
            return newSize;
        });

        return res.send(listSize);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
}
let totalProduct = async (req, res, next) => {
    try {
        // Lấy tất cả các sản phẩm variant
        let productVariants = await Product_Variant.findAll({
            attributes: ['quantity'] // Chỉ cần lấy thuộc tính quantity
        });

        // Tính tổng quantity
        let totalProducts = productVariants.reduce((total, variant) => total + variant.quantity, 0);

        // Trả về kết quả
        return res.send({ totalProducts });
    } catch (error) {
        console.error('Error calculating total products:', error);
        return res.status(500).send({ error: 'Error with calculating Total.' });
    }
}

module.exports = {
    create,
    update,
    listAdminSide,
    listCustomerSide,
    detailCustomerSide,
    detailAdminSide,
    listColour,
    listSize,
    totalProduct,
    listCustomerSearch
};

