import { authHeaders } from "./authHeaders";
import api from "./axios";


export const getGroupByUserId = async (token) => {
    const response = await api.get(`/group/user`, authHeaders(token));
    return response.data;
}

export const getGroupById = async (groupId, token) => {
    const response = await api.get(`/group/${groupId}`, authHeaders(token));
    return response.data;
}

export const createGroup = async (data, token) => {
    const response = await api.post('/group', data, authHeaders(token));
    return response.data;
};

export const updateGroup = async (groupId, data, token) => {
    const response = await api.put(`/group/${groupId}`, data, authHeaders(token));
    return response.data;
};

export const deleteGroup = async (groupId, token) => {
    const response = await api.delete(`/group/${groupId}`, authHeaders(token));
    return response.data;
};

export const getGroupDetails = async (groupId, token) => {
    const response = await api.get(`/group/${groupId}/groupDetails`, authHeaders(token));
    return response.data;
}


export const getGroupByInviteCode = async (inviteCode, token) => {
    const response = await api.get(`/group/join/${inviteCode}`, authHeaders(token));
    return response.data;
}

export const joinGroup = async (inviteCode, data, token) => {
    const response = await api.post(`/group/join/${inviteCode}`, data, authHeaders(token));
    return response.data;
};

export const regenerateInviteCode = async (groupId, token) => {
    const response = await api.post(`/group/${groupId}/invite-code/regenerate`, {}, authHeaders(token));
    return response.data;
};
