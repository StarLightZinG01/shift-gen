"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

type HorizontalScrollAreaProps = {
  children: ReactNode;
  className?: string;
  minWidth?: number;
};

export function HorizontalScrollArea({
  children,
  className = "",
  minWidth = 1520,
}: HorizontalScrollAreaProps) {
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const horizontalTargetRef = useRef<HTMLDivElement | null>(null);
  const isSyncingRef = useRef(false);
  const [scrollWidth, setScrollWidth] = useState(minWidth);

  useEffect(() => {
    const contentScroll = contentScrollRef.current;

    if (!contentScroll) {
      return;
    }

    const tableContainer = contentScroll.querySelector<HTMLDivElement>(
      '[data-slot="table-container"]',
    );
    const horizontalTarget = tableContainer ?? contentScroll;
    horizontalTargetRef.current = horizontalTarget;

    const previousOverflowX = tableContainer?.style.overflowX;
    if (tableContainer) {
      tableContainer.style.overflowX = "hidden";
    }

    const updateScrollWidth = () => {
      const tableWidth =
        tableContainer?.querySelector("table")?.scrollWidth ?? 0;

      setScrollWidth(
        Math.max(horizontalTarget.scrollWidth, tableWidth, minWidth),
      );
    };

    updateScrollWidth();

    const resizeObserver = new ResizeObserver(updateScrollWidth);
    resizeObserver.observe(contentScroll);
    resizeObserver.observe(horizontalTarget);

    const table = tableContainer?.querySelector("table");
    if (table) {
      resizeObserver.observe(table);
    }

    const mutationObserver = new MutationObserver(updateScrollWidth);
    mutationObserver.observe(contentScroll, {
      childList: true,
      subtree: true,
    });

    return () => {
      if (tableContainer) {
        tableContainer.style.overflowX = previousOverflowX ?? "";
      }
      horizontalTargetRef.current = null;
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [minWidth]);

  function syncScroll(source: "content" | "bottom") {
    if (isSyncingRef.current) {
      return;
    }

    const horizontalTarget = horizontalTargetRef.current;
    const bottomScroll = bottomScrollRef.current;

    if (!horizontalTarget || !bottomScroll) {
      return;
    }

    isSyncingRef.current = true;

    if (source === "bottom") {
      horizontalTarget.scrollLeft = bottomScroll.scrollLeft;
    } else {
      bottomScroll.scrollLeft = horizontalTarget.scrollLeft;
    }

    window.requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  }

  return (
    <div className="min-w-0">
      <div
        ref={contentScrollRef}
        className={`overflow-y-auto overflow-x-hidden ${className}`}
        onScroll={() => syncScroll("content")}
      >
        {children}
      </div>
      <div
        ref={bottomScrollRef}
        className="overflow-x-auto overflow-y-hidden border-t border-[#DDEBED] bg-white"
        aria-label="เลื่อนตารางซ้ายขวา"
        onScroll={() => syncScroll("bottom")}
      >
        <div style={{ width: scrollWidth, height: 14 }} />
      </div>
    </div>
  );
}
