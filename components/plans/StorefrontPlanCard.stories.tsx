import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';

import type { StorefrontPlan } from '@/lib/catalog/storefront';
import { StorefrontPlanCard } from './StorefrontPlanCard';

const plan: StorefrontPlan = {
  id: 'kenya-10gb',
  externalId: 'ke-10gb',
  title: 'Kenya 10 GB',
  destination: {
    id: 'kenya',
    title: 'Kenya',
    slug: 'kenya',
    countryCode: 'KE',
    image: null,
    planCount: 4,
    minimumPrice: { amount: 9, currency: 'USD' },
  },
  isRegional: false,
  dataLabel: '10 GB',
  dataAmountMb: 10240,
  isUnlimited: false,
  validityDays: 30,
  price: { amount: 24, cents: 2400, currency: 'USD' },
  operatorName: 'Safaricom',
  networks: ['Safaricom'],
  networkTypes: ['4G', '5G'],
  hotspot: true,
  callsAndSms: false,
  callsMinutes: null,
  texts: null,
  includesPhoneNumber: false,
  topUpAvailable: true,
  activationPolicy: 'Activates on first network connection',
  installWindowDays: 90,
  apn: 'globaldata',
  coverage: [{ name: 'Kenya', code: 'KE', slug: 'kenya' }],
  coverageVerified: true,
  fairUsagePolicy: null,
  shortInfo: 'Fast data for a month in Kenya.',
  otherInfo: null,
  lastSyncedAt: '2026-09-22T08:00:00.000Z',
};

const meta = {
  component: StorefrontPlanCard,
  tags: ['ai-generated'],
  args: { plan },
} satisfies Meta<typeof StorefrontPlanCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Details' })).toHaveAttribute(
      'href',
      '/plan/ke-10gb',
    );
  },
};

export const Compact: Story = {
  args: { compact: true },
};

export const WithBadge: Story = {
  args: { badge: 'Best value' },
};
