const notificationTypes = {
    GROUP_CREATED: 'GROUP_CREATED',
    EXPENSE_CREATED: 'EXPENSE_CREATED',
    DEBT_SETTLED: 'DEBT_SETTLED'
};

const sendNotificationToUser = (io, userId, type, message, data = {}) => {
    io.to(`user:${userId}`).emit('notification', {
        type,
        message,
        data
    });
};

module.exports = { notificationTypes, sendNotificationToUser };