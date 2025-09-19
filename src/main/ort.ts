import { ipcMain } from 'electron';
import * as ort from 'onnxruntime-node';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';

// ORT Session cache to avoid reloading models
const modelCache = new Map<string, ort.InferenceSession>();

// Initialize ORT with CPU provider
const initializeORT = async () => {
  try {
    // Set execution providers - prefer CPU for compatibility
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = true;

    log.info('ORT initialized successfully');
    return true;
  } catch (error) {
    log.error('Failed to initialize ORT:', error);
    return false;
  }
};

// Load a model from file path
const loadModel = async (modelPath: string): Promise<ort.InferenceSession | null> => {
  try {
    // Check cache first
    if (modelCache.has(modelPath)) {
      return modelCache.get(modelPath)!;
    }

    // Check if model file exists
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model file not found: ${modelPath}`);
    }

    // Create session
    const session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });

    // Cache the session
    modelCache.set(modelPath, session);

    log.info(`Model loaded successfully: ${modelPath}`);
    return session;
  } catch (error) {
    log.error(`Failed to load model ${modelPath}:`, error);
    return null;
  }
};

// Run inference on a loaded model
const runInference = async (
  session: ort.InferenceSession,
  inputData: Record<string, number[] | number[][]>,
): Promise<Record<string, any> | null> => {
  try {
    // Convert input data to tensors
    const feeds: Record<string, ort.Tensor> = {};

    for (const [inputName, data] of Object.entries(inputData)) {
      // Determine tensor shape based on data structure
      let shape: number[];
      let flatData: number[];

      if (Array.isArray(data[0])) {
        // 2D array
        const data2D = data as number[][];
        shape = [data2D.length, data2D[0].length];
        flatData = data2D.flat();
      } else {
        // 1D array
        const data1D = data as number[];
        shape = [data1D.length];
        flatData = data1D;
      }

      feeds[inputName] = new ort.Tensor('float32', new Float32Array(flatData), shape);
    }

    // Run inference
    const results = await session.run(feeds);

    // Convert results back to regular arrays
    const output: Record<string, any> = {};
    for (const [outputName, tensor] of Object.entries(results)) {
      output[outputName] = {
        data: Array.from(tensor.data as Float32Array),
        shape: tensor.dims,
      };
    }

    return output;
  } catch (error) {
    log.error('Inference failed:', error);
    return null;
  }
};

// Create a simple time series forecasting model (mock for demonstration)
const createSimpleTimeSeriesModel = async (): Promise<ort.InferenceSession | null> => {
  try {
    // For demo purposes, we'll create a simple linear regression model
    // In practice, you'd load a pre-trained ONNX model

    // This is a placeholder - in real implementation you'd have an actual ONNX model file
    // For now, we'll simulate model behavior in the forecast function
    log.info('Simple time series model created (simulated)');
    return null; // Will be handled in the forecast function
  } catch (error) {
    log.error('Failed to create time series model:', error);
    return null;
  }
};

// Simple time series forecasting function (using basic linear regression)
const forecastTimeSeries = async (
  timeSeriesData: Array<{ date: string; amount: number }>,
  forecastDays: number = 7,
): Promise<Array<{ date: string; amount: number; isForecast: boolean }> | null> => {
  try {
    if (timeSeriesData.length < 1) {
      throw new Error('Need at least 1 data point for forecasting');
    }

    // Handle forecasting logic
    const n = timeSeriesData.length;
    let slope = 0;
    let intercept = 0;

    if (n === 1) {
      // For single data point, assume flat trend with slight variation
      slope = 0;
      intercept = timeSeriesData[0].amount;
    } else {
      // Simple linear regression for multiple points
      const x = timeSeriesData.map((_, i) => i);
      const y = timeSeriesData.map(d => d.amount);

      // Calculate slope and intercept
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
      const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

      slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      intercept = (sumY - slope * sumX) / n;
    }

    // Generate forecast
    const lastDate = new Date(timeSeriesData[timeSeriesData.length - 1].date);
    const forecast: Array<{ date: string; amount: number; isForecast: boolean }> = [];

    // Add historical data
    timeSeriesData.forEach(d => {
      forecast.push({ ...d, isForecast: false });
    });

    // Add forecast points
    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + i);

      const forecastValue = slope * (n + i - 1) + intercept;

      // Add some randomness to make it more realistic
      let noise = 0;
      if (n === 1) {
        // For single data point, add more variation to show trend possibilities
        noise = (Math.random() - 0.5) * 0.3 * forecastValue;
      } else {
        // For multiple points, use standard noise
        noise = (Math.random() - 0.5) * 0.2 * forecastValue;
      }

      const adjustedValue = Math.max(0, forecastValue + noise);

      forecast.push({
        date: forecastDate.toISOString().split('T')[0],
        amount: adjustedValue,
        isForecast: true,
      });
    }

    return forecast;
  } catch (error) {
    log.error('Forecasting failed:', error);
    return null;
  }
};

// Setup ORT IPC handlers
export const setupOrtHandlers = () => {
  // Initialize ORT
  ipcMain.handle('ort:initialize', async () => {
    return await initializeORT();
  });

  // Load model
  ipcMain.handle('ort:load-model', async (event, modelPath: string) => {
    const session = await loadModel(modelPath);
    return session !== null;
  });

  // Run inference
  ipcMain.handle('ort:inference', async (event, modelPath: string, inputData: Record<string, number[] | number[][]>) => {
    const session = modelCache.get(modelPath);
    if (!session) {
      return { error: 'Model not loaded' };
    }

    const result = await runInference(session, inputData);
    return result || { error: 'Inference failed' };
  });

  // Time series forecasting
  ipcMain.handle('ort:forecast-timeseries', async (
    event,
    timeSeriesData: Array<{ date: string; amount: number }>,
    forecastDays: number = 7
  ) => {
    const result = await forecastTimeSeries(timeSeriesData, forecastDays);
    return result || { error: 'Forecasting failed' };
  });

  // Get model info
  ipcMain.handle('ort:model-info', async (event, modelPath: string) => {
    const session = modelCache.get(modelPath);
    if (!session) {
      return { error: 'Model not loaded' };
    }

    return {
      inputNames: session.inputNames,
      outputNames: session.outputNames,
    };
  });

  // Cleanup models
  ipcMain.handle('ort:cleanup', async () => {
    try {
      for (const [path, session] of modelCache.entries()) {
        await session.release();
      }
      modelCache.clear();
      return true;
    } catch (error) {
      log.error('Failed to cleanup ORT models:', error);
      return false;
    }
  });

  log.info('ORT IPC handlers registered');
};

// Cleanup function for app shutdown
export const cleanupORT = async () => {
  try {
    for (const [path, session] of modelCache.entries()) {
      await session.release();
    }
    modelCache.clear();
    log.info('ORT cleanup completed');
  } catch (error) {
    log.error('ORT cleanup failed:', error);
  }
};
