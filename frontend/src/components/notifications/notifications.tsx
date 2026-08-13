import { io, type Socket } from 'socket.io-client';
import { toast } from "react-toastify";
import { useEffect, useState } from 'react';
import { getUserSession } from '../../utils/localStorage';

interface NotificationEvent {
    message: string;
}

const Notifications = () => {
    const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const userId = getUserSession()?.id;

    useEffect(() => {
        const newSocket = io(import.meta.env.VITE_SOCKET_URL);
        setSocket(newSocket);

        newSocket.emit('register', userId);

        newSocket.on('notification', (data: NotificationEvent) => {
            setNotifications(prev => [...prev, data]);

            toast.info(data.message);
        });

        return () => {
            newSocket.disconnect();
        };
    }, [userId]);

    return null;
}

export default Notifications;
