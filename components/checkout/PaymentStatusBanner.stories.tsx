import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';

import { PaymentStatusBanner } from './PaymentStatusBanner';

const meta = {
  component: PaymentStatusBanner,
  tags: ['ai-generated'],
} satisfies Meta<typeof PaymentStatusBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Approved: Story = {
  args: { status: 'approved' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Payment approved');
  },
};

export const Pending: Story = {
  args: { status: 'pending' },
};

export const Failed: Story = {
  args: { status: 'failed' },
};

export const CustomMessage: Story = {
  args: {
    status: 'paid',
    message: 'Your eSIM is ready to install.',
  },
};
