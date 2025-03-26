export const getStorageObject = (key) => {
    const item = localStorage.getItem(key);
    if (item !== null) {
        return JSON.parse(item);
    }
    return null;
};

export const setStorageObject = (data) => {
    localStorage.setItem('user-session', data);
};

export const deleteStorageObject = (key) => {
    localStorage.removeItem(key);
};

export const getUserToken = () => {
    const session = getStorageObject('user-session')
    if (session) {
        return session.token
    }
    return null;
};

export const getUserSession = () => {
    const session = getStorageObject('user-session')
    if (session) {
        return session.user
    }
    return null;
};

export const removeSession = () => {
    deleteStorageObject('user-session');
};