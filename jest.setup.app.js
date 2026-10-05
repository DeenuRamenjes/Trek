/* global jest */
// App (React Native) project only.

require('react-native-gesture-handler/jestSetup');

// Skia needs a CanvasKit (WASM) environment that the jest-expo environment does not provide.
// Canvases render as plain Views and drawing nodes render nothing; visual output is checked on device.
jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Canvas = ({ children, style, testID, accessible, accessibilityLabel }) =>
    React.createElement(View, { style, testID, accessible, accessibilityLabel }, children);
  const Group = ({ children }) => React.createElement(React.Fragment, null, children);
  const Nothing = () => null;
  return { Canvas, Group, Path: Nothing };
});
