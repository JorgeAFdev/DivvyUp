import type { Meta, StoryObj } from '@storybook/react';
import Icon from '../components/icon/icon';

const meta: Meta<typeof Icon> = {
    component: Icon,
    argTypes: {
        variant: {
            control: { type: 'select' },
            options: ['add', 'edit', 'delete', 'light', 'dark', 'dots'],
        },
        className: {
            control: { type: 'select' },
            options: ['add', 'icon'],
        },
    },
};

export default meta;

type Story = StoryObj<typeof Icon>;

export const iconBasic: Story = {
    args: {
        className: 'add',
    },
};

export const iconEdit: Story = {
    args: {
        variant: 'edit',
    },
};

export const iconDelete: Story = {
    args: {
        variant: 'delete',
    },
};

export const iconTheme: Story = {
    args: {
        variant: 'dark',
    },
};
