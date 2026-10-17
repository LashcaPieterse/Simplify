import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';

import { Button } from './button';

const meta = {
  component: Button,
  tags: ['ai-generated'],
  args: {
    children: 'Buy this eSIM',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toHaveTextContent('Buy this eSIM');
  },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Compare plans' },
};

export const Disabled: Story = {
  args: { disabled: true, children: 'Unavailable' },
};

export const CssCheck: Story = {
  args: { children: 'Check styles' },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: /check styles/i });
    await expect(getComputedStyle(button).color).toBe('rgb(255, 255, 255)');
  },
};
