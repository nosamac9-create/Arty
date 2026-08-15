/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  ShieldAlert, CheckCircle, XCircle, Play, AlertTriangle,
  ChevronDown, ChevronUp, Download, RefreshCw, Database, Eye
} from 'lucide-react';
import { TestResult } from '../types';
import { formatTime } from '../utils/calendarConfig';
import {
  SYSTEM_TESTS, TEST_CATEGORY_ORDER, runSystemTests, SystemTestDefinition
} from '../utils/systemTests';

export const SystemHealthSection: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [lastRunTime, setLastRunTime] = useState<string | null>(null);
  const [failuresOnly, setFailuresOnly] = useState(false);

  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const toggleCategory = (cat: string) =>
    setCollapsedCats(prev => ({ ...prev, [cat]: !prev[cat] }));

  const totalTests = SYSTEM_TESTS.length;

  /** Runs the whole suite for real against the database. */
  const handleRunAll = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults([]);

    const collected = await runSystemTests({
      onProgress: (done, total, result) => {
        setProgress(done);
        // Rows appear as they finish rather than all at the end.
        setResults(prev => [...prev, result]);
      }
    });

    setResults(collected);
    setLastRunTime(`Today at ${formatTime(new Date())}`);
    setIsRunning(false);
  };

  /** Re-runs a single test and replaces just that row. */
  const handleRerun = async (id: string) => {
    setRunningTestId(id);
    const [updated] = await runSystemTests({ only: id });
    if (updated) {
      setResults(prev => {
        const next = prev.filter(r => r.id !== id);
        return [...next, updated];
      });
    }
    setRunningTestId(null);
  };

  const handleExport = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      results
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `arty_test_results_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const duration = results.reduce((sum, r) => sum + r.duration, 0);
    return { total: results.length, passed, failed, duration };
  }, [results]);

  /** Definitions joined to their latest result, grouped by category. */
  const categorized = useMemo(() => {
    const byId = new Map<string, TestResult>(results.map(r => [r.id, r]));
    const groups: Record<string, Array<{ def: SystemTestDefinition; result?: TestResult }>> = {};

    SYSTEM_TESTS.forEach(def => {
      const result = byId.get(def.id);
      if (failuresOnly && result?.status !== 'failed') return;
      if (!groups[def.category]) groups[def.category] = [];
      groups[def.category].push({ def, result });
    });

    return TEST_CATEGORY_ORDER
      .filter(cat => groups[cat]?.length)
      .map(cat => [cat, groups[cat]] as const);
  }, [results, failuresOnly]);

  const hasRun = results.length > 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 min-w-0 text-left bg-brand-cream min-h-full">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-brand-clay/60">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-charcoal">System Health &amp; Test Suite</h1>
          <p className="text-xs text-brand-charcoal/60 mt-1">
            Runs real checks against the live database and the shared validation layer.
            Tests that need to write data use a temporary database that is deleted when the run finishes.
          </p>
        </div>

        <div className="bg-white border border-brand-clay/70 px-3 py-2 rounded-xl flex items-center gap-2 self-start sm:self-auto">
          <Database className="h-4 w-4 text-brand-sage" />
          <span className="text-[10px] font-bold text-brand-charcoal/70 uppercase tracking-wider">
            {totalTests} real tests
          </span>
        </div>
      </div>

      {/* Banner */}
      {isRunning ? (
        <div className="bg-brand-sand border border-brand-clay p-5 rounded-2xl space-y-3 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold text-brand-charcoal">
            <span className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-brand-terracotta animate-spin" />
              <span>Running the suite against the database...</span>
            </span>
            <span>Test {progress} of {totalTests}</span>
          </div>
          <div className="w-full bg-brand-cream border border-brand-clay/40 rounded-full h-3 overflow-hidden">
            <div
              className="bg-brand-terracotta h-full rounded-full transition-all duration-150"
              style={{ width: `${(progress / totalTests) * 100}%` }}
            />
          </div>
        </div>
      ) : !hasRun ? (
        <div className="bg-white border border-brand-clay p-5 rounded-2xl flex items-start gap-4 shadow-sm">
          <div className="h-12 w-12 rounded-xl bg-brand-sand text-brand-charcoal/60 flex items-center justify-center shrink-0">
            <Eye className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-brand-charcoal">No results yet</h3>
            <p className="text-xs text-brand-charcoal/65 mt-1 leading-relaxed font-semibold">
              Press Run All Tests to execute the {totalTests} checks. Nothing is written to your real records.
            </p>
          </div>
        </div>
      ) : stats.failed > 0 ? (
        <div className="bg-red-50 border-2 border-brand-terracotta p-5 rounded-2xl flex items-start gap-4 shadow-sm">
          <div className="h-12 w-12 rounded-xl bg-brand-terracotta text-brand-cream flex items-center justify-center shrink-0">
            <ShieldAlert className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-red-900">
              {stats.failed} of {stats.total} tests failing
            </h3>
            <p className="text-xs text-red-800 mt-1 leading-relaxed font-semibold">
              Open the failing rows below for what was expected, what actually happened, and what it means.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border-2 border-green-500 p-5 rounded-2xl flex items-start gap-4 shadow-sm animate-in fade-in duration-300">
          <div className="h-12 w-12 rounded-xl bg-green-500 text-brand-cream flex items-center justify-center shrink-0">
            <CheckCircle className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-green-900">
              All checks passed — {stats.passed}/{stats.total}
            </h3>
            <p className="text-xs text-green-800 mt-1 leading-relaxed font-semibold">
              Validation rules, capacity handling, queue behaviour, piece history and referential integrity all held.
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-brand-clay/70 p-4 rounded-xl text-left">
          <span className="text-[10px] font-bold text-brand-charcoal/50 uppercase block">Passed</span>
          <span className="text-2xl font-extrabold text-green-600 block mt-1">{stats.passed}</span>
        </div>
        <div className="bg-white border border-brand-clay/70 p-4 rounded-xl text-left">
          <span className="text-[10px] font-bold text-brand-charcoal/50 uppercase block">Failed</span>
          <span className={`text-2xl font-extrabold block mt-1 ${stats.failed > 0 ? 'text-brand-terracotta' : 'text-brand-charcoal/30'}`}>
            {stats.failed}
          </span>
        </div>
        <div className="bg-white border border-brand-clay/70 p-4 rounded-xl text-left">
          <span className="text-[10px] font-bold text-brand-charcoal/50 uppercase block">Not yet run</span>
          <span className="text-2xl font-extrabold text-brand-charcoal/35 block mt-1">{totalTests - stats.total}</span>
        </div>
        <div className="bg-white border border-brand-clay/70 p-4 rounded-xl text-left">
          <span className="text-[10px] font-bold text-brand-charcoal/50 uppercase block">Total duration</span>
          <span className="text-2xl font-extrabold text-brand-charcoal block mt-1">{stats.duration} ms</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap justify-between items-center gap-3 bg-white border border-brand-clay/70 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunAll}
            disabled={isRunning}
            className="cursor-pointer bg-brand-charcoal text-brand-cream hover:bg-brand-charcoal/90 disabled:opacity-40 font-bold text-xs px-5 py-3 rounded-xl flex items-center gap-2 shadow-sm transition-all"
          >
            <Play className="h-4 w-4 text-brand-terracotta fill-brand-terracotta" />
            <span>{isRunning ? 'Running...' : 'Run All Tests'}</span>
          </button>

          <p className="text-xs text-brand-charcoal/60 font-semibold hidden sm:block">
            Last run: <span className="font-bold">{lastRunTime || 'never'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFailuresOnly(!failuresOnly)}
            className={`cursor-pointer px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              failuresOnly
                ? 'bg-brand-terracotta text-brand-cream border-brand-terracotta'
                : 'bg-brand-cream border-brand-clay text-brand-charcoal/70'
            }`}
          >
            Failures only
          </button>

          <button
            onClick={handleExport}
            disabled={!hasRun}
            className="cursor-pointer bg-brand-cream hover:bg-brand-sand border border-brand-clay text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            <span>Export Results</span>
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-4">
        {categorized.length === 0 && failuresOnly && (
          <div className="bg-white border border-brand-clay/70 p-6 rounded-2xl text-center text-xs font-semibold text-brand-charcoal/50">
            No failures to show.
          </div>
        )}

        {categorized.map(([cat, list]) => {
          const isCollapsed = collapsedCats[cat];
          const hasFailure = list.some(x => x.result?.status === 'failed');
          const anyRun = list.some(x => x.result);

          return (
            <div key={cat} className="bg-white border border-brand-clay/70 rounded-2xl overflow-hidden shadow-2xs">
              <div
                onClick={() => toggleCategory(cat)}
                className="cursor-pointer p-4 bg-brand-cream/35 hover:bg-brand-sand/20 border-b border-brand-clay/40 flex justify-between items-center"
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className={`h-2.5 w-2.5 rounded-full ${
                    !anyRun ? 'bg-brand-charcoal/20' : hasFailure ? 'bg-brand-terracotta animate-pulse' : 'bg-green-500'
                  }`} />
                  <h3 className="font-display font-extrabold text-sm text-brand-charcoal">{cat}</h3>
                  <span className="text-[10px] text-brand-charcoal/40 font-bold">({list.length} tests)</span>

                  {/* Per-page pass/fail, so it is obvious which page is broken */}
                  {anyRun && (
                    <span className="flex items-center gap-1.5">
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-green-100 text-green-800 border border-green-300">
                        {list.filter(x => x.result?.status === 'passed').length} passed
                      </span>
                      {list.some(x => x.result?.status === 'failed') && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-300">
                          {list.filter(x => x.result?.status === 'failed').length} failed
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <button className="text-brand-charcoal/50">
                  {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
              </div>

              {!isCollapsed && (
                <div className="divide-y divide-brand-clay/30">
                  {list.map(({ def, result }) => (
                    <div key={def.id} className="p-4 space-y-3 hover:bg-brand-sand/5 transition-colors text-xs text-left">

                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-2.5">
                          {!result ? (
                            <span className="h-4.5 w-4.5 rounded-full border-2 border-brand-clay shrink-0 mt-0.5" />
                          ) : result.status === 'passed' ? (
                            <CheckCircle className="h-4.5 w-4.5 text-green-500 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-4.5 w-4.5 text-brand-terracotta shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="font-bold text-brand-charcoal">
                              {def.name}
                              <span className="font-mono text-[9px] text-brand-sage ml-1 border border-brand-clay/50 px-1.5 py-0.2 rounded bg-brand-sand">
                                {def.id}
                              </span>
                              <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                def.kind === 'audit'
                                  ? 'bg-brand-cream text-brand-charcoal/60 border-brand-clay/60'
                                  : 'bg-brand-sage/10 text-brand-sage border-brand-sage/25'
                              }`}>
                                {def.kind === 'audit' ? 'live data audit' : 'temp-db scenario'}
                              </span>
                            </p>
                            <p className="text-[11px] text-brand-charcoal/65 font-medium mt-0.5">{def.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px] font-mono font-bold text-brand-charcoal/40">
                            {result ? `${result.duration} ms` : '—'}
                          </span>
                          <button
                            type="button"
                            disabled={isRunning || runningTestId === def.id}
                            onClick={() => handleRerun(def.id)}
                            title="Re-run this test"
                            className="p-1 hover:bg-brand-sand rounded text-brand-charcoal/40 hover:text-brand-terracotta cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${runningTestId === def.id ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {/* Expected vs actual — shown for failures, and for passes so the
                          reader can see what was actually measured. */}
                      {result && (
                        <div className={`p-4 rounded-xl space-y-2.5 ml-7 border ${
                          result.status === 'failed' ? 'bg-red-50/50 border-red-200' : 'bg-brand-cream/40 border-brand-clay/40'
                        }`}>
                          {result.status === 'failed' && (
                            <div className="flex items-start gap-1.5 text-red-700 font-extrabold text-[10px] uppercase tracking-wider">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                              <span>{result.failureMessage}</span>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-mono">
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-brand-charcoal/50 block">Expected:</span>
                              <pre className="bg-brand-cream border border-brand-clay p-2.5 rounded-lg text-green-700 block whitespace-pre-wrap leading-relaxed font-bold">
                                {result.expected}
                              </pre>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-brand-charcoal/50 block">Actual:</span>
                              <pre className={`bg-brand-cream border p-2.5 rounded-lg block whitespace-pre-wrap leading-relaxed font-bold ${
                                result.status === 'failed' ? 'border-red-300 text-red-600' : 'border-brand-clay text-brand-charcoal/80'
                              }`}>
                                {result.actual}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};
