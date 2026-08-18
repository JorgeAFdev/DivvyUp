import type {
    Group,
    GroupDetails,
    InviteCode,
    InviteInfo,
    InviteName,
} from '@monorepo/shared';
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

export const getGroupByUserId = async (): Promise<Group[]> => {
    const response = await api.get<Group[]>(`/group/user`);
    return response.data;
};

export const getGroupById = async (groupId: string): Promise<Group> => {
    const response = await api.get<Group>(`/group/${groupId}`);
    return response.data;
};

export const createGroup = async (data: GroupInput): Promise<Group> => {
    const response = await api.post<Group>('/group', data);
    return response.data;
};

export const updateGroup = async (groupId: string, data: GroupInput): Promise<Group> => {
    const response = await api.put<Group>(`/group/${groupId}`, data);
    return response.data;
};

export const deleteGroup = async (groupId: string): Promise<void> => {
    await api.delete(`/group/${groupId}`);
};

export const getGroupDetails = async (groupId: string): Promise<GroupDetails> => {
    const response = await api.get<GroupDetails>(`/group/${groupId}/groupDetails`);
    return response.data;
};

export const getInviteName = async (inviteCode: string): Promise<InviteName> => {
    const response = await api.get<InviteName>(`/group/invite/${inviteCode}`);
    return response.data;
};

export const getGroupByInviteCode = async (inviteCode: string): Promise<InviteInfo> => {
    const response = await api.get<InviteInfo>(`/group/join/${inviteCode}`);
    return response.data;
};

export const joinGroup = async (inviteCode: string, data: JoinGroupInput): Promise<Group> => {
    const response = await api.post<Group>(`/group/join/${inviteCode}`, data);
    return response.data;
};

export const regenerateInviteCode = async (groupId: string): Promise<InviteCode> => {
    const response = await api.post<InviteCode>(`/group/${groupId}/invite-code/regenerate`, {});
    return response.data;
};
