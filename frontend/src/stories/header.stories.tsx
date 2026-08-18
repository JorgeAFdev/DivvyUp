import type { Meta, StoryObj } from '@storybook/react';
import { BrowserRouter } from 'react-router-dom';
import Header from '../components/header/header';

const meta: Meta<typeof Header> = {
    component: Header,
    decorators: [
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
