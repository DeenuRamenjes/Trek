import { Children, isValidElement, ReactNode } from 'react';
import { SlideUp } from './presets';
import { staggerDelay } from './tokens';

/** Slides each child up in turn, 40 ms apart (capped at the 8th child). */
export function Stagger({ children }: { children: ReactNode }) {
  return (
    <>
      {Children.toArray(children).map((child, index) => (
        <SlideUp key={isValidElement(child) && child.key != null ? child.key : index} delay={staggerDelay(index)}>
          {child}
        </SlideUp>
      ))}
    </>
  );
}
