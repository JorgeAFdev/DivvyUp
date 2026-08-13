import type {
    Group,
    GroupDetails,
    InviteCode,
    InviteInfo,
    InviteName,
} from '@monorepo/shared';
import { authHeaders } from './authHeaders';
import api from './axios';

export interface GroupMemberInput {
    _id?: string;
    name: string;
}

export interface GroupInput {
    name: string;
    description?: string;
    members: GroupMemberInput[];
}

export interface JoinGroupInput {
    memberId?: string;
    name?: string;
}

export const getGroupByUserId = async (token: string | null): Promise<Group[]> => {
    const response = await api.get<Group[]>(`/group/user`, authHeaders(token));
    return response.data;
};

export const getGroupById = async (groupId: string, token: string | null): Promise<Group> => {
    const response = await api.get<Group>(`/group/${groupId}`, authHeaders(token));
    return response.data;
};

export const createGroup = async (data: GroupInput, token: string | null): Promise<Group> => {
    const response = await api.post<Group>('/group', data, authHeaders(token));
    return response.data;
};

export const updateGroup = async (groupId: string, data: GroupInput, token: string | null): Promise<Group> => {
    const response = await api.put<Group>(`/group/${groupId}`, data, authHeaders(token));
    return response.data;
};

export const deleteGroup = async (groupId: string, token: string | null): Promise<void> => {
    await api.delete(`/group/${groupId}`, authHeaders(token));
};

export const getGroupDetails = async (groupId: string, token: string | null): Promise<GroupDetails> => {
    const response = await api.get<GroupDetails>(`/group/${groupId}/groupDetails`, authHeaders(token));
    return response.data;
};

export const getInviteName = async (inviteCode: string): Promise<InviteName> => {
    const response = await api.get<InviteName>(`/group/invite/${inviteCode}`);
    return response.data;
};

export const getGroupByInviteCode = async (inviteCode: string, token: string | null): Promise<InviteInfo> => {
    const response = await api.get<InviteInfo>(`/group/join/${inviteCode}`, authHeaders(token));
    return response.data;
};

export const joinGroup = async (inviteCode: string, data: JoinGroupInput, token: string | null): Promise<Group> => {
    const response = await api.post<Group>(`/group/join/${inviteCode}`, data, authHeaders(token));
    return response.data;
};

export const regenerateInviteCode = async (groupId: string, token: string | null): Promise<InviteCode> => {
    const response = await api.post<InviteCode>(`/group/${groupId}/invite-code/regenerate`, {}, authHeaders(token));
    return response.data;
};
