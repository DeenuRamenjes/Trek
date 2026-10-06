const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// drizzle's generated migrations.js imports .sql files (inlined by babel-plugin-inline-import).
config.resolver.sourceExts.push('sql');

module.exports = config;
