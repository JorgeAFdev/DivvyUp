import type { Meta, StoryObj } from '@storybook/react';
import { MdAddCircleOutline, MdEdit, MdOutlineDarkMode } from 'react-icons/md';
import { FaTrashAlt } from 'react-icons/fa';
import Icon from '../components/icon/icon';

const meta: Meta<typeof Icon> = {
    component: Icon,
};

export default meta;

type Story = StoryObj<typeof Icon>;

export const iconBasic: Story = {
    args: {
        icon: MdAddCircleOutline,
        size: 45,
    },
};

export const iconEdit: Story = {
    args: {
        icon: MdEdit,
    },
};

export const iconDelete: Story = {
    args: {
        icon: FaTrashAlt,
    },
};

export const iconTheme: Story = {
    args: {
        icon: MdOutlineDarkMode,
        size: 25,
    },
};
