import { withKinstate } from '@kinstate/compiler/next';

export default withKinstate({
  transpilePackages: ['@kinstate/core', '@kinstate/react'],
  reactStrictMode: true,
});
