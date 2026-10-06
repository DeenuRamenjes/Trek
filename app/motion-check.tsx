import { Redirect } from 'expo-router';
import { MotionCheck } from '../src/dev/routes/MotionCheck';

export default function MotionCheckRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <MotionCheck />;
}
