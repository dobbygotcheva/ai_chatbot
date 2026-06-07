import { useCallback, useEffect, useRef, useState } from "react";

export function useScrollToBottom() {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isAtBottomRef = useRef(true);
  const isUserScrollingRef = useRef(false);
  /** Prevents auto-scroll from being blocked when scroll events come from our own scrollTo */
  const isProgrammaticScrollRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  const checkIfAtBottom = useCallback(() => {
    if (!containerRef.current) {
      return true;
    }
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    return scrollTop + clientHeight >= scrollHeight - 100;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    isProgrammaticScrollRef.current = true;
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
    const clearMs = behavior === "smooth" ? 400 : 80;
    window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, clearMs);
  }, []);

  /** Re-enable follow mode and jump to the end (user sent a message or assistant reply started). */
  const scrollToLatestReply = useCallback(() => {
    setIsAtBottom(true);
    isAtBottomRef.current = true;
    const container = containerRef.current;
    if (!container) {
      return;
    }
    isProgrammaticScrollRef.current = true;
    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "auto",
      });
      window.setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 80);
    });
  }, []);

  // Handle user scroll events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let scrollTimeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) {
        const atBottom = checkIfAtBottom();
        setIsAtBottom(atBottom);
        isAtBottomRef.current = atBottom;
        return;
      }

      isUserScrollingRef.current = true;
      clearTimeout(scrollTimeout);

      const atBottom = checkIfAtBottom();
      setIsAtBottom(atBottom);
      isAtBottomRef.current = atBottom;

      scrollTimeout = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 150);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [checkIfAtBottom]);

  // Auto-scroll when content changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scrollIfNeeded = () => {
      if (isAtBottomRef.current && !isUserScrollingRef.current) {
        const container = containerRef.current;
        if (!container) {
          return;
        }
        requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = true;
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "auto",
          });
          setIsAtBottom(true);
          isAtBottomRef.current = true;
          window.setTimeout(() => {
            isProgrammaticScrollRef.current = false;
          }, 80);
        });
      }
    };

    // Watch for DOM changes
    const mutationObserver = new MutationObserver(scrollIfNeeded);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Watch for size changes
    const resizeObserver = new ResizeObserver(scrollIfNeeded);
    resizeObserver.observe(container);

    // Also observe children for size changes
    for (const child of container.children) {
      resizeObserver.observe(child);
    }

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, []);

  function onViewportEnter() {
    setIsAtBottom(true);
    isAtBottomRef.current = true;
  }

  function onViewportLeave() {
    setIsAtBottom(false);
    isAtBottomRef.current = false;
  }

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    scrollToLatestReply,
    onViewportEnter,
    onViewportLeave,
  };
}
