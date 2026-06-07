"use client";

import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

interface WordStreamProps {
  text: string;
  delay: number;
  className?: string;
  isStreaming?: boolean;
}

function splitChars(text: string): string[] {
  return text.split("");
}

export function WordStream({
  text,
  delay,
  className,
  isStreaming,
}: WordStreamProps) {
  const delayRef = useRef(delay);
  const textRef = useRef(text);
  const charsRef = useRef<string[]>(splitChars(text));
  const [displayedCharCount, setDisplayedCharCount] = useState(0);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    const textChanged = text !== textRef.current;

    if (textChanged) {
      textRef.current = text;
      charsRef.current = splitChars(text);
    }
    delayRef.current = delay;

    if (delay === 0) {
      setDisplayedCharCount(charsRef.current.length);
    }
  }, [text, delay]);

  useEffect(() => {
    if (delay === 0) {
      return;
    }

    if (isStreaming && !hasStartedRef.current) {
      hasStartedRef.current = true;
    }

    if (!hasStartedRef.current) {
      if (!isStreaming && text.length > 0) {
        setDisplayedCharCount(charsRef.current.length);
      }
      return;
    }

    if (displayedCharCount >= charsRef.current.length) {
      return;
    }

    const interval = setInterval(() => {
      setDisplayedCharCount((prev) => {
        if (prev >= charsRef.current.length) {
          return charsRef.current.length;
        }
        return prev + 1;
      });
    }, delayRef.current);

    return () => clearInterval(interval);
  }, [delay, displayedCharCount, isStreaming, text.length]);

  return (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto",
        className
      )}
    >
      {delay === 0
        ? text
        : charsRef.current.slice(0, displayedCharCount).join("")}
    </Streamdown>
  );
}
