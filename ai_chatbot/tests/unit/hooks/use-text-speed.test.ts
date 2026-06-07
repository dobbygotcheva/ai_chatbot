import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTextSpeed } from "@/hooks/use-text-speed";

vi.mock("usehooks-ts", () => ({
  useLocalStorage: vi.fn(),
}));

const { useLocalStorage } = await import("usehooks-ts");

describe("useTextSpeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return default speed of 100 and delay of 0ms on first render", () => {
    const setSliderValue = vi.fn();
    const reset = vi.fn();
    vi.mocked(useLocalStorage).mockReturnValue([100, setSliderValue, reset]);

    const { result } = renderHook(() => useTextSpeed());

    expect(result.current.speed).toBe(100);
    expect(result.current.delay).toBe(0);
  });

  it("should return 0ms delay at slider=100 (fastest)", () => {
    const setSliderValue = vi.fn();
    const reset = vi.fn();
    vi.mocked(useLocalStorage).mockReturnValue([100, setSliderValue, reset]);

    const { result } = renderHook(() => useTextSpeed());

    expect(result.current.delay).toBe(0);
  });

  it("should return 40ms delay at slider=0 (slowest)", () => {
    const setSliderValue = vi.fn();
    const reset = vi.fn();
    vi.mocked(useLocalStorage).mockReturnValue([0, setSliderValue, reset]);

    const { result } = renderHook(() => useTextSpeed());

    expect(result.current.delay).toBe(40);
  });

  it("should provide setSpeed function to update slider value", () => {
    const setSliderValue = vi.fn();
    const reset = vi.fn();
    vi.mocked(useLocalStorage).mockReturnValue([100, setSliderValue, reset]);

    const { result } = renderHook(() => useTextSpeed());

    expect(result.current.setSpeed).toBeDefined();
    expect(typeof result.current.setSpeed).toBe("function");
  });
});
