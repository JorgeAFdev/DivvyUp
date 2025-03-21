import { io } from 'socket.io-client';
import { toast } from "react-toastify";
import { useEffect, useState } from 'react';
import { getUserSession } from '../../utils/localStorage';


const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [socket, setSocket] = useState(null);
    const { id: userId } = getUserSession();

    useEffect(() => {
        const newSocket = io('http://localhost:3001');
        setSocket(newSocket);

        newSocket.emit('register', userId);

        newSocket.on('notification', (data) => {
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