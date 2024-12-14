const Category = require('../models/category');

let createLevel1 = async (req, res, next) => {
    try {
        let title = req.body.title;
        if (title === undefined) return res.status(400).send(' title not exists');
        let category = await Category.findOne({ where: { title } });
        if (category) return res.status(409).send('Category exists');
        else {
            let newCategory = await Category.create({ title });
            return res.send(newCategory);
        }
    } catch (err) {
        console.log(err)
        return res.status(500).send('Error');
    }
}

let createLevel2 = async (req, res, next) => {
    try {
        let title = req.body.title;
        if (title === undefined) return res.status(400).send(' title not exists');
        let parent_id = req.body.parent_id;
        if (parent_id === undefined) return res.status(400).send(' parent_id not exists');
        let parentCategory = await Category.findOne({ where: { category_id: parent_id } });
        if (!parentCategory) return res.status(400).send('parent_id not exists');
        let category = await Category.findOne({ where: { title: title, level: 2 } });
        if (category) return res.status(409).send('Category exists');
        else {
            let newCategory = await Category.create({ title, level: 2, parent_id });
            return res.send(newCategory);
        }
    } catch (err) {
        console.log(err)
        return res.status(500).send('Error');
    }
}

let nestList = async (req, res, next) => {
    try {
        let listCategoryLevel1 = await Category.findAll({
            where: { parent_id: null, state: 1 },  // Thêm điều kiện state = 1
            attributes: ['category_id', 'title'],
            raw: true
        });

        let listCategory = [];
        for (let { category_id, title } of listCategoryLevel1) {
            let listCategoryLevel2 = await Category.findAll({
                where: { parent_id: category_id, state: 1 },  // Thêm điều kiện state = 1
                attributes: ['category_id', 'title'],
                raw: true
            });
            let category = { category_id, title, children: listCategoryLevel2 };
            listCategory.push(category);
        }

        res.send(listCategory);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error');
    }
};

let list = async (req, res, next) => {
    try {
        let categoryList = await Category.findAll({ raw: true, order: [['level', 'ASC'],]})
        categoryList = await Promise.all(categoryList.map(async (category) => {
            let parent
            if (category.parent_id != null) {
                parent = await Category.findOne({ attributes: ['title'], where: { category_id: category.parent_id } })
                return {
                    category_id: category.category_id,
                    title: category.title,
                    level: category.level,
                    parent: parent.title,
                    state: category.state
                }
            }
            else {
                return {
                    category_id: category.category_id,
                    title: category.title,
                    level: category.level,
                    parent: null,
                    state: category.state
                }
            }
        }))
        return res.send(categoryList)
    } catch (err) {
        console.log(err)
        return res.status(500).send('Error');
    }
}

let listLevel1 = async (req, res, next) => {
    try {
        let categories = await Category.findAll({
            where: { parent_id: null },
            attributes: ['category_id', 'title'],
            raw: true
        });
        return res.send(categories);
    } catch (err) {
        console.log(err)
        return res.status(500).send('Error');
    }
}
let onState = async (req, res, next) => {
    try {
        let category_ids = req.body.category_ids;
        if (category_ids === undefined) return res.status(400).send(' category_id not exists');
        await Category.update(
            { state: true },
            { where: { category_id: category_ids } }
        )
        return res.send({ message: 'Successful product variant launch!' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('Error');
    }
}

let offState = async (req, res, next) => {
    try {
        let category_ids = req.body.category_ids;
        if (category_ids === undefined) return res.status(400).send(' category_id not exists');
        Category.update(
            { state: false },
            { where: { category_id: category_ids } }
        )
        return res.send({ message: 'Product variation disabled successfully!' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('Error');
    }
}

module.exports = {
    createLevel1,
    createLevel2,
    nestList,
    list,
    listLevel1,
    onState,
    offState,
};
