/**
 * Performance Monitoring Utility for BetGPT
 *
 * Provides utilities for tracking and reporting performance metrics
 * including page load times, component render times, and API response times.
 */

// Performance metrics interface
interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

// Storage for performance metrics
const metrics: PerformanceMetric[] = [];

/**
 * Mark the start of a performance measurement
 */
export const markStart = (name: string): void => {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(`${name}-start`);
  }
};

/**
 * Mark the end of a performance measurement and calculate duration
 */
export const markEnd = (name: string, metadata?: Record<string, any>): number => {
  if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
    performance.mark(`${name}-end`);

    try {
      performance.measure(name, `${name}-start`, `${name}-end`);
      const measure = performance.getEntriesByName(name)[0];
      const duration = measure.duration;

      // Store metric
      metrics.push({
        name,
        value: duration,
        timestamp: Date.now(),
        metadata,
      });

      // Clean up marks
      performance.clearMarks(`${name}-start`);
      performance.clearMarks(`${name}-end`);
      performance.clearMeasures(name);

      return duration;
    } catch (error) {
      console.warn('Performance measurement failed:', error);
      return 0;
    }
  }
  return 0;
};

/**
 * Measure the time taken by an async function
 */
export const measureAsync = async <T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> => {
  markStart(name);
  try {
    const result = await fn();
    const duration = markEnd(name, metadata);

    if (duration > 1000) {
      console.warn(`⚠️ Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
    }

    return result;
  } catch (error) {
    markEnd(name, { ...metadata, error: true });
    throw error;
  }
};

/**
 * Measure the time taken by a synchronous function
 */
export const measureSync = <T>(
  name: string,
  fn: () => T,
  metadata?: Record<string, any>
): T => {
  markStart(name);
  try {
    const result = fn();
    const duration = markEnd(name, metadata);

    if (duration > 100) {
      console.warn(`⚠️ Slow render detected: ${name} took ${duration.toFixed(2)}ms`);
    }

    return result;
  } catch (error) {
    markEnd(name, { ...metadata, error: true });
    throw error;
  }
};

/**
 * Get all recorded metrics
 */
export const getMetrics = (): PerformanceMetric[] => {
  return [...metrics];
};

/**
 * Get metrics by name
 */
export const getMetricsByName = (name: string): PerformanceMetric[] => {
  return metrics.filter(m => m.name === name);
};

/**
 * Get average duration for a named metric
 */
export const getAverageDuration = (name: string): number => {
  const namedMetrics = getMetricsByName(name);
  if (namedMetrics.length === 0) return 0;

  const sum = namedMetrics.reduce((acc, m) => acc + m.value, 0);
  return sum / namedMetrics.length;
};

/**
 * Clear all metrics
 */
export const clearMetrics = (): void => {
  metrics.length = 0;
};

/**
 * Log performance summary to console
 */
export const logPerformanceSummary = (): void => {
  if (metrics.length === 0) {
    console.log('No performance metrics recorded');
    return;
  }

  const uniqueNames = [...new Set(metrics.map(m => m.name))];

  console.group('🚀 Performance Summary');
  uniqueNames.forEach(name => {
    const namedMetrics = getMetricsByName(name);
    const avg = getAverageDuration(name);
    const min = Math.min(...namedMetrics.map(m => m.value));
    const max = Math.max(...namedMetrics.map(m => m.value));

    console.log(`📊 ${name}:`);
    console.log(`  - Count: ${namedMetrics.length}`);
    console.log(`  - Average: ${avg.toFixed(2)}ms`);
    console.log(`  - Min: ${min.toFixed(2)}ms`);
    console.log(`  - Max: ${max.toFixed(2)}ms`);
  });
  console.groupEnd();
};

/**
 * Report Web Vitals (Core Web Vitals)
 */
export const reportWebVitals = (): void => {
  if (typeof window === 'undefined' || !window.performance) return;

  try {
    // Get navigation timing
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    if (navigation) {
      const metrics = {
        // Time to First Byte
        ttfb: navigation.responseStart - navigation.requestStart,
        // DOM Content Loaded
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        // Load Complete
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        // DOM Interactive
        domInteractive: navigation.domInteractive - navigation.fetchStart,
      };

      console.group('📈 Web Vitals');
      console.log(`⏱️ Time to First Byte (TTFB): ${metrics.ttfb.toFixed(2)}ms`);
      console.log(`📄 DOM Content Loaded: ${metrics.domContentLoaded.toFixed(2)}ms`);
      console.log(`✅ Load Complete: ${metrics.loadComplete.toFixed(2)}ms`);
      console.log(`⚡ DOM Interactive: ${metrics.domInteractive.toFixed(2)}ms`);
      console.groupEnd();
    }

    // Report LCP (Largest Contentful Paint) if available
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log(`🎨 Largest Contentful Paint (LCP): ${lastEntry.startTime.toFixed(2)}ms`);
      });

      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    }
  } catch (error) {
    console.warn('Could not report web vitals:', error);
  }
};

/**
 * Hook for React components to measure render time
 */
export const usePerformanceMonitor = (componentName: string) => {
  if (typeof window === 'undefined') return;

  const renderStart = Date.now();

  return () => {
    const renderDuration = Date.now() - renderStart;
    if (renderDuration > 16) { // More than one frame (60fps)
      console.warn(`⚠️ Slow render: ${componentName} took ${renderDuration}ms`);
    }
  };
};

/**
 * Initialize performance monitoring
 */
export const initPerformanceMonitoring = (): void => {
  // Report web vitals on load
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      setTimeout(() => {
        reportWebVitals();
        logPerformanceSummary();
      }, 0);
    });
  }
};

// Auto-initialize in development
if (import.meta.env.DEV) {
  initPerformanceMonitoring();
}
