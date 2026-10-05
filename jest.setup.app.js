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
  const Path = Nothing;
  const Path2 = { Make: () => ({ addArc: () => undefined }) };
  return { Canvas, Group, Path, Rect: Nothing, Line: Nothing, Skia: { Path: Path2 } };
});

// victory-native needs Skia + a measured canvas; charts render as plain Views and are checked on device.
jest.mock('victory-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Nothing = () => null;
  const CartesianChart = ({ testID }) => React.createElement(View, { testID });
  return { CartesianChart, Bar: Nothing, Line: Nothing };
});

// Biometrics and blur are native; tests drive the auth mock directly.
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}));
jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { BlurView: ({ children, ...props }) => React.createElement(View, props, children) };
});
