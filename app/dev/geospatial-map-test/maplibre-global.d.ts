declare global {
  interface Window {
    maplibregl?: {
      AttributionControl: new (options?: Record<string, unknown>) => unknown;
      Map: new (options: Record<string, unknown>) => unknown;
      NavigationControl: new (options?: Record<string, unknown>) => unknown;
    };
  }
}

export {};
