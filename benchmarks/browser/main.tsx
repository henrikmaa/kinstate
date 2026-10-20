import { runBenchmark } from './runner.js';

declare global {
  interface Window {
    runBenchmark: typeof runBenchmark;
    benchmarkReady: boolean;
    benchmarkProduction: boolean;
  }
}
window.runBenchmark = runBenchmark;
window.benchmarkReady = true;
window.benchmarkProduction = import.meta.env.PROD;
