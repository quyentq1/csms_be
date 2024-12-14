const { DataTypes } = require('sequelize');

const { sequelize } = require('../configs/database');
const User = require('./user');


const Notification = sequelize.define('Notification', {
    content: { type: DataTypes.STRING, allowNull: true },
    title: { type: DataTypes.STRING, allowNull: true },
    user_id: { type: DataTypes.CHAR(255), primaryKey: true },
    status: { type: DataTypes.INTEGER, allowNull: true }
}, {
	timestamps: true,
	createdAt: 'created_at',
	updatedAt: false
})

User.hasMany(Notification, {
    foreignKey: { name: 'user_id', type: DataTypes.UUID, allowNull: false }
});

module.exports = Notification;