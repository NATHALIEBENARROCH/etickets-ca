"use client";

import { useEffect, useMemo, useState } from "react";

type GeoCarouselIndicatorsProps = {
  containerId: string;
  itemCount: number;
};

export default function GeoCarouselIndicators({ containerId, itemCount }: GeoCarouselIndicatorsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 860px)");
    if (!mediaQuery.matches) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    const cards = Array.from(container.querySelectorAll<HTMLElement>(".tb-geo-card"));
    if (cards.length === 0) return;

    const updateActiveIndex = () => {
      const scrollLeft = container.scrollLeft;
      let nextActive = 0;
      let shortestDistance = Number.POSITIVE_INFINITY;

      cards.forEach((card, index) => {
        const distance = Math.abs(card.offsetLeft - scrollLeft);
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nextActive = index;
        }
      });

      setActiveIndex(nextActive);
    };

    updateActiveIndex();
    container.addEventListener("scroll", updateActiveIndex, { passive: true });
    window.addEventListener("resize", updateActiveIndex);

    return () => {
      container.removeEventListener("scroll", updateActiveIndex);
      window.removeEventListener("resize", updateActiveIndex);
    };
  }, [containerId, itemCount]);

  const indicators = useMemo(() => {
    return Array.from({ length: itemCount }, (_, index) => index);
  }, [itemCount]);

  if (itemCount <= 1) return null;

  return (
    <div className="tb-geo-carousel-meta" aria-hidden>
      <div className="tb-geo-dots">
        {indicators.map((index) => (
          <span
            key={index}
            className={`tb-geo-dot${index === activeIndex ? " is-active" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
