import type { Meta, StoryObj } from '@storybook/react';
import { BrowserRouter } from 'react-router-dom';
import GuestHeader from '../components/header/guestHeader';

// The full Header picks its variant from the live Better Auth session, which
// needs a network round trip Storybook cannot answer, so it renders null here
// and asserts nothing. The guest header is the presentational half worth a
// browser smoke test (it once rendered white on a white surface); the variant
// selection itself is covered by header.test.tsx with a mocked session.
const meta: Meta<typeof GuestHeader> = {
    component: GuestHeader,
    decorators: [
        (Story) => (
            <BrowserRouter>
                <Story />
            </BrowserRouter>
        ),
    ],
};

export default meta;

type Story = StoryObj<typeof GuestHeader>;

export const Guest: Story = {};
