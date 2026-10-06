import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logError } from '../services/errorLog';
import { strings } from '../strings/en';
import { AppText, Button, Screen } from './components';

interface Props {
  children: ReactNode;
}

/** Catches render errors, logs them locally and shows a calm fallback. Must sit inside ThemeProvider. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void logError('react.boundary', Object.assign(new Error(error.message), { stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}` }));
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Screen centered>
        <AppText variant="title" accessibilityRole="header">
          {strings.errorLog.boundaryTitle}
        </AppText>
        <AppText tone="secondary">{strings.errorLog.boundaryBody}</AppText>
        <Button
          label={strings.errorLog.retry}
          accessibilityLabel={strings.errorLog.retry}
          onPress={() => this.setState({ failed: false })}
        />
      </Screen>
    );
  }
}
