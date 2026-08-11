"use client";

import { MotionConfig } from "motion/react";
import { SmoothScroll } from "@/components/motion/smooth-scroll";

/**
 * `reducedMotion="user"` makes every `motion` component drop transform and layout
 * animation when the OS asks for it, while still allowing opacity fades. Combined
 * with the media query in globals.css it means we never have to guard animations
 * individually.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <SmoothScroll />
      {children}
    </MotionConfig>
  );
}
