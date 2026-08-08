"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

type RankKey = number | string;

export function useAnimatedRankOrder(order: RankKey[]) {
  const nodesRef = useRef(new Map<RankKey, HTMLElement>());
  const previousPositionsRef = useRef(new Map<RankKey, DOMRect>());
  const hasMeasuredRef = useRef(false);
  const orderKey = order.join("|");

  const registerNode = useCallback((key: RankKey, node: HTMLElement | null) => {
    if (node) {
      nodesRef.current.set(key, node);
      return;
    }

    nodesRef.current.delete(key);
  }, []);

  useLayoutEffect(() => {
    const nextPositions = new Map<RankKey, DOMRect>();

    nodesRef.current.forEach((node, key) => {
      nextPositions.set(key, node.getBoundingClientRect());
    });

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (hasMeasuredRef.current && !prefersReducedMotion) {
      nodesRef.current.forEach((node, key) => {
        const previousPosition = previousPositionsRef.current.get(key);
        const nextPosition = nextPositions.get(key);

        if (!previousPosition || !nextPosition) {
          return;
        }

        const offsetY = previousPosition.top - nextPosition.top;

        if (Math.abs(offsetY) < 1) {
          return;
        }

        const direction = Math.sign(offsetY);
        node.getAnimations().forEach((animation) => animation.cancel());
        node.animate(
          [
            {
              transform: `translateY(${offsetY}px) scale(0.985)`,
              offset: 0,
            },
            {
              transform: `translateY(${-direction * 10}px) scale(1.008)`,
              offset: 0.72,
            },
            {
              transform: `translateY(${direction * 4}px) scale(0.998)`,
              offset: 0.88,
            },
            { transform: "translateY(0) scale(1)", offset: 1 },
          ],
          {
            duration: 920,
            easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
          }
        );
      });
    }

    previousPositionsRef.current = nextPositions;
    hasMeasuredRef.current = true;
  }, [orderKey]);

  return registerNode;
}
