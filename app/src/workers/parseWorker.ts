/// <reference lib="webworker" />
import { parseStreamingHistoryMulti } from '../data/parseExport';
import { classifyFileParsed, type FileReport, type PickedFile } from '../data/importFiles';

/**
 * Parses export files off the main thread so large histories do not freeze
 * the UI. Receives the picked files (already extracted from any ZIP on the
 * main thread), recognizes which ones carry listening history, reports
 * per-file progress, and returns the combined ParseSummary plus one report
 * per picked file. Non-history files in the batch (playlists, account data,
 * search queries, ...) are skipped, not fatal; only a batch with no history
 * at all is an error.
 */
self.onmessage = (e: MessageEvent<PickedFile[]>) => {
  try {
    const reports: FileReport[] = [];
    const historyParts: { json: unknown; report: FileReport }[] = [];
    e.data.forEach((file, i) => {
      const { report, json } = classifyFileParsed(file);
      reports.push(report);
      if (report.status === 'loaded') {
        historyParts.push({ json, report });
      }
      postMessage({ progress: { done: i + 1, total: e.data.length } });
    });
    if (historyParts.length === 0) {
      throw new Error(
        'No listening history found in these files. The app needs the Streaming History files from Spotify\'s "Account data" or "Extended streaming history" package - the guide explains how to request them.',
      );
    }
    const summary = parseStreamingHistoryMulti(historyParts.map((p) => p.json));
    postMessage({ ok: true, summary, reports });
  } catch (err) {
    postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
