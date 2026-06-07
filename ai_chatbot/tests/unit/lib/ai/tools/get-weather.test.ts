import type { Tool } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getWeather, weatherInputSchema } from "@/lib/ai/tools/get-weather";

const mockFetch = vi.fn();
global.fetch = mockFetch;

interface WeatherResult {
  current?: { temperature_2m: number; time?: string };
  daily?: { sunrise: string[]; sunset: string[] };
  cityName?: string;
  error?: string;
}

const weatherTool = getWeather as Tool & {
  execute: (input: {
    latitude?: number;
    longitude?: number;
    city?: string;
  }) => Promise<WeatherResult>;
};

describe("getWeather tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should have valid input schema", () => {
    const validCity = weatherInputSchema.safeParse({ city: "Sofia" });
    expect(validCity.success).toBe(true);

    const validCoords = weatherInputSchema.safeParse({
      latitude: 42.6977,
      longitude: 23.3219,
    });
    expect(validCoords.success).toBe(true);

    const validEmpty = weatherInputSchema.safeParse({});
    expect(validEmpty.success).toBe(true);
  });

  it("should accept city name only", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ latitude: 42.6977, longitude: 23.3219 }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ current: { temperature_2m: 20 } }),
      });

    const result = await weatherTool.execute({ city: "Sofia" });

    expect(result).toHaveProperty("current");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should accept coordinates only", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ current: { temperature_2m: 20 } }),
    });

    const result = await weatherTool.execute({
      latitude: 42.6977,
      longitude: 23.3219,
    });

    expect(result).toHaveProperty("current");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should return error when neither city nor coordinates provided", async () => {
    const result = await weatherTool.execute({});

    expect(result).toEqual({
      error:
        "Please provide either a city name or both latitude and longitude coordinates.",
    });
  });

  it("should successfully geocode city name and fetch weather", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ latitude: 37.7749, longitude: -122.4194 }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ current: { temperature_2m: 18 } }),
      });

    await weatherTool.execute({ city: "San Francisco" });

    expect(mockFetch.mock.calls[0][0]).toContain(
      "geocoding-api.open-meteo.com"
    );
    expect(mockFetch.mock.calls[0][0]).toContain("San%20Francisco");
  });

  it("should handle city not found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const result = await weatherTool.execute({ city: "InvalidCityName123" });

    expect(result).toEqual({
      error:
        'Could not find coordinates for "InvalidCityName123". Please check the city name.',
    });
  });

  it("should fetch weather data from open-meteo API", async () => {
    const mockWeatherData = {
      current: {
        temperature_2m: 25,
        time: "2024-01-15T10:00",
      },
      daily: {
        sunrise: ["2024-01-15T07:00"],
        sunset: ["2024-01-15T17:00"],
      },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockWeatherData,
    });

    const result = await weatherTool.execute({
      latitude: 42.6977,
      longitude: 23.3219,
    });

    expect(result).toEqual(mockWeatherData);
    expect(mockFetch.mock.calls[0][0]).toContain("api.open-meteo.com");
    expect(mockFetch.mock.calls[0][0]).toContain("latitude=42.6977");
  });

  it("should include cityName in response when city is provided", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ latitude: 42.6977, longitude: 23.3219 }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ current: { temperature_2m: 20 } }),
      });

    const result = await weatherTool.execute({ city: "Sofia" });

    expect(result).toHaveProperty("cityName", "Sofia");
  });
});
