// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const parentNodeModules = path.resolve(workspaceRoot, 'node_modules').replace(/\\/g, '\\\\');

const config = getDefaultConfig(projectRoot);

// Never resolve JS dependencies from the library root's node_modules. That tree
// pins react-native@0.82 for package tests while the example uses Expo 56 / RN 0.85.
config.resolver.blockList = [
  ...Array.from(config.resolver.blockList ?? []),
  new RegExp(`${parentNodeModules}(?:/|$)`),
];

config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

const forcedModules = ['expo', 'react', 'react-native', '@react-native/virtualized-lists'];
const extraNodeModules = {
  'react-native-ble-nfc-reader': workspaceRoot,
};

for (const moduleName of forcedModules) {
  extraNodeModules[moduleName] = path.dirname(
    require.resolve(`${moduleName}/package.json`, { paths: [projectRoot] })
  );
}

config.resolver.extraNodeModules = extraNodeModules;

config.watchFolders = [workspaceRoot];

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
