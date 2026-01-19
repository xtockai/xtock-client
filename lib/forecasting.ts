/**
 * Advanced Forecasting Module
 * Uses multiple statistical methods with all historical data
 */

interface SalesRecord {
  date: string;
  item: string;
  quantity: number;
}

interface ForecastResult {
  [item: string]: number;
}

interface TimeSeriesData {
  date: Date;
  quantity: number;
  dayOfWeek: number;
  weekOfYear: number;
  daysSinceStart: number;
}

/**
 * Advanced forecasting using ensemble of methods:
 * 1. Weighted Moving Average (recent data weighted more)
 * 2. Exponential Smoothing
 * 3. Day-of-week patterns
 * 4. Linear trend
 * 5. Seasonal decomposition
 */
export function advancedForecast(
  historicalData: SalesRecord[],
  targetDate?: Date
): ForecastResult {
  const target = targetDate || getTomorrowDate();
  const targetDayOfWeek = target.getDay();

  // Group data by item
  const itemData: { [item: string]: TimeSeriesData[] } = {};

  historicalData.forEach((record) => {
    if (!itemData[record.item]) {
      itemData[record.item] = [];
    }

    const date = new Date(record.date);
    itemData[record.item].push({
      date,
      quantity: record.quantity,
      dayOfWeek: date.getDay(),
      weekOfYear: getWeekOfYear(date),
      daysSinceStart: 0, // Will calculate later
    });
  });

  const predictions: ForecastResult = {};

  // Forecast for each item
  Object.keys(itemData).forEach((item) => {
    const timeSeries = itemData[item].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    if (timeSeries.length === 0) {
      predictions[item] = 0;
      return;
    }

    // Calculate days since start for trend analysis
    const startDate = timeSeries[0].date.getTime();
    timeSeries.forEach((point) => {
      point.daysSinceStart =
        Math.floor((point.date.getTime() - startDate) / (1000 * 60 * 60 * 24)) +
        1;
    });

    // Use ensemble of methods
    const methods = [
      weightedMovingAverage(timeSeries, 0.7), // 70% weight on recent 30%
      exponentialSmoothing(timeSeries, 0.3), // Alpha = 0.3
      dayOfWeekPattern(timeSeries, targetDayOfWeek),
      linearTrendForecast(timeSeries),
    ];

    // Weighted ensemble (you can adjust weights)
    const weights = [0.3, 0.3, 0.25, 0.15];
    let forecast = 0;
    methods.forEach((value, idx) => {
      forecast += value * weights[idx];
    });

    predictions[item] = Math.max(0, Math.round(forecast));
  });

  return predictions;
}

/**
 * Weighted Moving Average
 * Recent data points have exponentially higher weight
 */
function weightedMovingAverage(
  timeSeries: TimeSeriesData[],
  recentWeight: number = 0.7
): number {
  if (timeSeries.length === 0) return 0;

  const n = timeSeries.length;
  let weightedSum = 0;
  let totalWeight = 0;

  timeSeries.forEach((point, index) => {
    // Exponential weight: more recent = higher weight
    const weight = Math.exp((index / n) * recentWeight * 3);
    weightedSum += point.quantity * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Exponential Smoothing
 * Classic time series forecasting method
 */
function exponentialSmoothing(
  timeSeries: TimeSeriesData[],
  alpha: number = 0.3
): number {
  if (timeSeries.length === 0) return 0;

  let smoothed = timeSeries[0].quantity;

  for (let i = 1; i < timeSeries.length; i++) {
    smoothed = alpha * timeSeries[i].quantity + (1 - alpha) * smoothed;
  }

  return smoothed;
}

/**
 * Day of Week Pattern
 * Calculates average for the same day of week
 */
function dayOfWeekPattern(
  timeSeries: TimeSeriesData[],
  targetDayOfWeek: number
): number {
  const sameDayData = timeSeries.filter(
    (point) => point.dayOfWeek === targetDayOfWeek
  );

  if (sameDayData.length === 0) {
    // Fallback to overall average
    const sum = timeSeries.reduce((acc, point) => acc + point.quantity, 0);
    return timeSeries.length > 0 ? sum / timeSeries.length : 0;
  }

  // Weighted average of same day of week (recent occurrences weighted more)
  let weightedSum = 0;
  let totalWeight = 0;

  sameDayData.forEach((point, index) => {
    const weight = Math.exp((index / sameDayData.length) * 2);
    weightedSum += point.quantity * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Linear Trend Forecast
 * Uses simple linear regression to predict based on trend
 */
function linearTrendForecast(timeSeries: TimeSeriesData[]): number {
  if (timeSeries.length < 2) {
    return timeSeries.length > 0 ? timeSeries[0].quantity : 0;
  }

  const n = timeSeries.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  timeSeries.forEach((point) => {
    const x = point.daysSinceStart;
    const y = point.quantity;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });

  // Calculate slope (m) and intercept (b) for y = mx + b
  const denominator = n * sumX2 - sumX * sumX;

  if (denominator === 0) {
    // No trend, return average
    return sumY / n;
  }

  const m = (n * sumXY - sumX * sumY) / denominator;
  const b = (sumY - m * sumX) / n;

  // Predict for next day
  const nextDay = timeSeries[n - 1].daysSinceStart + 1;
  const prediction = m * nextDay + b;

  return prediction;
}

/**
 * Get tomorrow's date
 */
function getTomorrowDate(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

/**
 * Get week of year (1-52)
 */
function getWeekOfYear(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear =
    (date.getTime() - firstDayOfYear.getTime()) / (1000 * 60 * 60 * 24);
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

/**
 * Legacy simple forecast (kept for backwards compatibility)
 */
export function simpleForecast(
  historicalData: SalesRecord[]
): ForecastResult {
  const itemData: { [item: string]: number[] } = {};

  historicalData.forEach((record) => {
    if (!itemData[record.item]) {
      itemData[record.item] = [];
    }
    itemData[record.item].push(record.quantity);
  });

  const predictions: ForecastResult = {};

  Object.keys(itemData).forEach((item) => {
    const quantities = itemData[item];
    const last7 = quantities.slice(-7);
    const avg =
      last7.length > 0 ? last7.reduce((a, b) => a + b, 0) / last7.length : 0;
    predictions[item] = Math.round(avg);
  });

  return predictions;
}
