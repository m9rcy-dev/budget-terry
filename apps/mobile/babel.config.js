module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Required by react-native-reanimated (used by @react-navigation/drawer)
    // — must stay last in the plugins list per its own setup docs.
    plugins: ["react-native-reanimated/plugin"],
  };
};
