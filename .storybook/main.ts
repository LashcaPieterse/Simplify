import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  "stories": [
    "../components/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-mcp",
    "msw-storybook-addon"
  ],
  "framework": "@storybook/nextjs-vite",
  "staticDirs": [
    "../public"
  ],
  viteFinal(config) {
    // Next 16.3+ reads parentRenderTree in useRouter. Storybook 10.6 still
    // supplies the older parentCacheNode shape. Keep this shim in the preview
    // build only, until Storybook's AppRouterProvider supports that context.
    config.optimizeDeps = {
      ...config.optimizeDeps,
      exclude: [...(config.optimizeDeps?.exclude ?? []), '@storybook/nextjs-vite'],
    };
    config.plugins = [...(config.plugins ?? []), {
      name: 'storybook-next-16-router-context',
      enforce: 'pre',
      transform(source, id) {
        if (!id.includes('/@storybook/nextjs-vite/') || !source.includes('parentCacheNode: newLazyCacheNode,')) return;
        return source.replace(
          'parentCacheNode: newLazyCacheNode,',
          'parentCacheNode: newLazyCacheNode, parentRenderTree: { data: { bfcacheId: 0 } },',
        );
      },
    }];
    return config;
  },
};
export default config;
