import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { Route } from 'next';
import { expect } from 'storybook/test';

import {
  DestinationSearch,
  type DestinationSearchOption,
} from './DestinationSearch';

const options: DestinationSearchOption[] = [
  {
    id: 'kenya',
    title: 'Kenya',
    subtitle: 'Country plan',
    href: '/country/kenya' as Route,
    type: 'country',
    searchTerms: ['nairobi', 'east africa'],
    countryCode: 'KE',
  },
  {
    id: 'south-africa',
    title: 'South Africa',
    subtitle: 'Country plan',
    href: '/country/south-africa' as Route,
    type: 'country',
    searchTerms: ['cape town', 'johannesburg'],
    countryCode: 'ZA',
  },
  {
    id: 'africa',
    title: 'Africa Regional',
    subtitle: 'Multi-country plan',
    href: '/bundle/africa' as Route,
    type: 'region',
    searchTerms: ['regional', 'multi country'],
  },
];

const meta = {
  component: DestinationSearch,
  tags: ['ai-generated'],
  args: {
    options,
    popular: ['Kenya', 'South Africa'],
  },
} satisfies Meta<typeof DestinationSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FilteredResults: Story = {
  play: async ({ canvas, userEvent }) => {
    const search = canvas.getByRole('combobox');
    await userEvent.click(search);
    await userEvent.type(search, 'Ken');
    await expect(canvas.getByRole('option', { name: /Kenya/i })).toBeVisible();
    await expect(search).toHaveAttribute('aria-expanded', 'true');
  },
};

export const WithoutPopularShortcuts: Story = {
  args: { popular: [] },
};
