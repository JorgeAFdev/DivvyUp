import type { Meta, StoryObj } from '@storybook/react';
import { BrowserRouter } from 'react-router-dom';
import Header from '../components/header/header';
import { AuthProvider } from '../context/userContextAuth';

const meta: Meta<typeof Header> = {
    component: Header,
    decorators: [
        (Story) => (
            <AuthProvider>
                <Story />
            </AuthProvider>
        ),

        (Story) => (
            <BrowserRouter>
                <Story />
            </BrowserRouter>
        ),
    ],
};

export default meta;

type Story = StoryObj<typeof Header>;

export const HeaderBasic: Story = {};

export const HeaderWitAvatar: Story = {
    decorators: [
        (Story) => (
            <AuthProvider>
                <Story />
            </AuthProvider>
        ),
    ],
};
