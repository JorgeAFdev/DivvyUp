import { io } from 'socket.io-client';
import { toast } from "react-toastify";
import { useEffect } from 'react';
import { useAuth } from '../../context/userContextAuth';

interface NotificationEvent {
    message: string;
}

const Notifications = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        // withCredentials sends the session cookie in the handshake; the server
        // derives the user:<id> room from the validated session, so there is no
        // 'register' emit and no client-supplied userId to spoof anymore.
        const socket = io(import.meta.env.VITE_SOCKET_URL, { withCredentials: true });

        socket.on('notification', (data: NotificationEvent) => {
            toast.info(data.message);
        });

        return () => {
            socket.disconnect();
        };
    }, [user]);

    return null;
}

export default Notifications;
