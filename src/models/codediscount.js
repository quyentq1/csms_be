const { DataTypes } = require('sequelize');

const { sequelize } = require('../configs/database');

const Codediscount = sequelize.define('Codediscount', {
    code: { type: DataTypes.CHAR(14), allowNull: false },
    money: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    status: { type: DataTypes.INTEGER, allowNull: true }
}, {
	timestamps: true,
	createdAt: 'created_at',
	updatedAt: false
})

module.exports = Codediscount;