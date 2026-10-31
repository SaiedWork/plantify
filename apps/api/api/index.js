// Vercel function entry. Plain JS on purpose: Nest needs tsc's decorator metadata, so it is
// compiled by `nest build` into dist/ and only re-exported here.
export { default } from '../dist/serverless.js';
