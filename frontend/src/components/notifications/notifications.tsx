import { io } from 'socket.io-client';
import { toast } from "react-toastify";
import { useEffect } from 'react';
import { getUserSession } from '../../utils/localStorage';

interface NotificationEvent {
    message: string;
}

const Notifications = () => {
    const userId = getUserSession()?.id;

    useEffect(() => {
        const socket = io(import.meta.env.VITE_SOCKET_URL);

        socket.emit('register', userId);

        socket.on('notification', (data: NotificationEvent) => {
            toast.info(data.message);
        });

        return () => {
            socket.disconnect();
        };
    }, [userId]);

    return null;
}

export default Notifications;
