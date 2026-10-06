import { screen } from '@testing-library/react-native';

/** Every button on screen must carry a non-empty accessibility label. */
export function expectAllButtonsLabelled(): number {
  const buttons = screen.queryAllByRole('button');
  for (const button of buttons) {
    const label = button.props.accessibilityLabel as unknown;
    expect(typeof label === 'string' && label.trim().length > 0).toBe(true);
  }
  return buttons.length;
}

const PRESSABLE_ROLES = ['button', 'switch', 'checkbox', 'radio', 'tab', 'link', 'togglebutton', 'menuitem'];

function labelOf(element: { props: Record<string, unknown> }): string | undefined {
  const label = (element.props.accessibilityLabel ?? element.props['aria-label']) as unknown;
  return typeof label === 'string' && label.trim().length > 0 ? label : undefined;
}

/**
 * Every interactive element (a host view with a press handler, or any element with an interactive role) must have an
 * accessibility role and a non-empty name (explicit label or visible text). Returns how many were checked.
 */
export function expectAllPressablesLabelled(): number {
  const offenders: string[] = [];
  let checked = 0;
  const walk = (node: { type?: unknown; props: Record<string, unknown>; children?: unknown[] }) => {
    const props = node.props ?? {};
    if (typeof node.type === 'string' && props.accessible !== false) {
      const role = (props.accessibilityRole ?? props.role) as string | undefined;
      const pressable = typeof props.onClick === 'function' || (role !== undefined && PRESSABLE_ROLES.includes(role));
      const hidden = props.importantForAccessibility === 'no-hide-descendants' || props['aria-hidden'] === true;
      if (pressable && !hidden) {
        checked += 1;
        const named = labelOf(node) !== undefined || screenText(node).trim().length > 0;
        if (!named || role === undefined) offenders.push(`${String(role)}:${labelOf(node) ?? screenText(node)}`);
      }
    }
    for (const child of node.children ?? []) {
      if (typeof child === 'object' && child !== null) walk(child as never);
    }
  };
  walk(screen.root as never);
  expect(offenders).toEqual([]);
  return checked;
}

function screenText(node: { children?: unknown[] }): string {
  let out = '';
  for (const child of node.children ?? []) {
    if (typeof child === 'string') out += child;
    else if (typeof child === 'object' && child !== null) out += screenText(child as never);
  }
  return out;
}
