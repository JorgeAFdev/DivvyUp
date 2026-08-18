import type { HydratedExpense, UserExpensesGroup } from '@monorepo/shared';
import api from './axios';

export interface ExpenseInput {
    description: string;
    totalAmount: number;
    paidBy: string;
    participants: string[];
}

export const getAllUserExpenses = async (): Promise<UserExpensesGroup[]> => {
    const response = await api.get<UserExpensesGroup[]>(`/user/expenses`);
    return response.data;
};

export const getAllGroupExpensesById = async (groupId: string): Promise<HydratedExpense[]> => {
    const response = await api.get<HydratedExpense[]>(`/group/${groupId}/expenses`);
    return response.data;
};

export const createGroupExpense = async (groupId: string, data: ExpenseInput): Promise<HydratedExpense> => {
    const response = await api.post<HydratedExpense>(`/group/${groupId}/expenses`, data);
    return response.data;
};

export const updateGroupExpense = async (
    groupId: string,
    expenseId: string,
    data: ExpenseInput,
): Promise<HydratedExpense> => {
    const response = await api.patch<HydratedExpense>(`/group/${groupId}/expenses/${expenseId}`, data);
    return response.data;
};

export const deleteGroupExpense = async (
    groupId: string,
    expenseId: string,
): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/group/${groupId}/expenses/${expenseId}`);
    return response.data;
};
