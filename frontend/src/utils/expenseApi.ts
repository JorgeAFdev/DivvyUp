import type { HydratedExpense, UserExpensesGroup } from '@monorepo/shared';
import { authHeaders } from './authHeaders';
import api from './axios';

export interface ExpenseInput {
    description: string;
    totalAmount: number;
    paidBy: string;
    participants: string[];
}

export const getAllUserExpenses = async (token: string): Promise<UserExpensesGroup[]> => {
    const response = await api.get<UserExpensesGroup[]>(`/user/expenses`, authHeaders(token));
    return response.data;
};

export const getAllGroupExpensesById = async (groupId: string, token: string): Promise<HydratedExpense[]> => {
    const response = await api.get<HydratedExpense[]>(`/group/${groupId}/expenses`, authHeaders(token));
    return response.data;
};

export const createGroupExpense = async (groupId: string, data: ExpenseInput, token: string): Promise<HydratedExpense> => {
    const response = await api.post<HydratedExpense>(`/group/${groupId}/expenses`, data, authHeaders(token));
    return response.data;
};

export const updateGroupExpense = async (
    groupId: string,
    expenseId: string,
    data: ExpenseInput,
    token: string,
): Promise<HydratedExpense> => {
    const response = await api.patch<HydratedExpense>(`/group/${groupId}/expenses/${expenseId}`, data, authHeaders(token));
    return response.data;
};

export const deleteGroupExpense = async (
    groupId: string,
    expenseId: string,
    token: string,
): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/group/${groupId}/expenses/${expenseId}`, authHeaders(token));
    return response.data;
};
