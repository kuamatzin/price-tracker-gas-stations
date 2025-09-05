import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface SwipeableTabsProps {
  tabs: {
    id: string;
    label: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
  }[];
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
  className?: string;
}

export const SwipeableTabs: React.FC<SwipeableTabsProps> = ({
  tabs,
  defaultTab,
  onTabChange,
  className,
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number | null>(null);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    const index = tabs.findIndex((tab) => tab.id === activeTab);
    if (index !== -1) {
      currentIndexRef.current = index;
    }
  }, [activeTab, tabs]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null) return;

    const touch = e.touches[0];
    const diff = touch.clientX - startXRef.current;

    // Add resistance at edges
    const maxSwipe = window.innerWidth / 3;
    const resistedDiff = Math.sign(diff) * Math.min(Math.abs(diff), maxSwipe);

    setSwipeOffset(resistedDiff);
  };

  const handleTouchEnd = () => {
    if (startXRef.current === null) return;

    const threshold = window.innerWidth / 4;

    if (Math.abs(swipeOffset) > threshold) {
      const direction = swipeOffset > 0 ? -1 : 1;
      const newIndex = currentIndexRef.current + direction;

      if (newIndex >= 0 && newIndex < tabs.length) {
        const newTab = tabs[newIndex];
        setActiveTab(newTab.id);
        onTabChange?.(newTab.id);
      }
    }

    setSwipeOffset(0);
    setIsSwiping(false);
    startXRef.current = null;
  };

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTab);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Tab Headers */}
      <div className="flex border-b bg-white sticky top-0 z-10">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative",
              activeTab === tab.id
                ? "text-blue-600"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {activeTab === tab.id && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 transition-all duration-300"
                style={{
                  transform: `translateX(${(index - activeTabIndex) * 100}%)`,
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content with Swipe */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex h-full transition-transform"
          style={{
            transform: `translateX(calc(${-activeTabIndex * 100}% + ${swipeOffset}px))`,
            transition: isSwiping ? "none" : "transform 0.3s ease",
          }}
        >
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className="w-full h-full flex-shrink-0 overflow-auto"
            >
              {tab.content}
            </div>
          ))}
        </div>

        {/* Swipe Indicators */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                index === activeTabIndex
                  ? "w-6 bg-blue-600"
                  : "w-1.5 bg-gray-300",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
