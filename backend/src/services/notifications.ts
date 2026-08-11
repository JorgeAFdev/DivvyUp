import type { Server } from 'socket.io';

const notificationTypes = {
    GROUP_CREATED: 'GROUP_CREATED',
    EXPENSE_CREATED: 'EXPENSE_CREATED',
    DEBT_SETTLED: 'DEBT_SETTLED'
};

const sendNotificationToUser = (io: Server, userId: string, type: string, message: string, data: Record<string, unknown> = {}) => {
    io.to(`user:${userId}`).emit('notification', {
        type,
        message,
        data
    });
};

export { notificationTypes, sendNotificationToUser };