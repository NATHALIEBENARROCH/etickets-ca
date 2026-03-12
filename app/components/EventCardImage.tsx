"use client";

import { useMemo, useState } from "react";

type EventCardImageProps = {
  sources: string[];
  alt: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function EventCardImage({ sources, alt, className, style }: EventCardImageProps) {
  const resolvedSources = useMemo(() => {
    const cleaned = sources
      .map((value) => (value || "").trim())
      .filter(Boolean);

    const unique = Array.from(new Set(cleaned));
    return unique.length > 0 ? unique : ["/hero.png"];
  }, [sources]);

  const [sourceIndex, setSourceIndex] = useState(0);
  const currentSource = resolvedSources[Math.min(sourceIndex, resolvedSources.length - 1)] || "/hero.png";

  return (
    <img
      src={currentSource}
      alt={alt}
      className={className}
      style={style}
      onError={() => {
        setSourceIndex((currentIndex) => {
          if (currentIndex >= resolvedSources.length - 1) return currentIndex;
          return currentIndex + 1;
        });
      }}
    />
  );
}
