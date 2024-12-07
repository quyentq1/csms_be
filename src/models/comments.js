const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../configs/database');
const User = require('./user');
const Product = require('./product');

class Comment extends Model {}

Comment.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    product_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Product,
            key: 'product_id'
        }
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'user_id'
        }
    },
    comment_text: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    parent_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'comments', // tên bảng cho liên kết chính nó
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    sequelize,
    modelName: 'Comment',
    tableName: 'Comments',
    timestamps: false
});

Comment.belongsTo(User, { foreignKey: 'user_id' });
Comment.belongsTo(Product, { foreignKey: 'product_id' });
Comment.hasMany(Comment, { as: 'replies', foreignKey: 'parent_id' });

module.exports = Comment;
