/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, CheckCircle, XCircle, Play, AlertTriangle, 
  ChevronDown, ChevronUp, Download, Eye, FileText, Settings, Sparkles, RefreshCw
} from 'lucide-react';
import { TestResult } from '../types';

export const SystemHealthSection: React.FC = () => {
  // Test failure mode simulator
  const [failingMode, setFailingMode] = useState<boolean>(false);
  const [failuresOnly, setFailuresOnly] = useState<boolean>(false);
  
  // Running state simulation
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runProgress, setRunProgress] = useState<number>(47);
  const [lastRunTime, setLastRunTime] = useState<string>('Sunday, July 19, 2026, 11:00 AM');

  // Collapsed categories state
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({
    'Database': false,
    'Authentication': false,
    'Roles & Permissions': true,
    'Bookings & Capacity': false,
    'Queue': false,
    'Pieces': false,
    'Data Integrity': true,
    'Routes': true,
  });

  const toggleCategory = (cat: string) => {
    setCollapsedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Run suite simulation
  const triggerRunSuite = () => {
    setIsRunning(true);
    setRunProgress(0);
  };

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setRunProgress((prev) => {
        if (prev >= 47) {
          clearInterval(interval);
          setIsRunning(false);
          const now = new Date();
          setLastRunTime(`Today at ${now.toLocaleTimeString()}`);
          return 47;
        }
        return prev + 3; // jump 3 tests at a time for realism
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning]);

  // List of 47 mock tests organized by category matching TestResult exactly
  const allTests: TestResult[] = useMemo(() => {
    return [
      // 1. Database (6 tests)
      { id: 'DB-101', name: 'PostgreSQL connection ping', description: 'Validates instant ping to Cloud SQL database instance.', duration: 4, status: 'passed', category: 'Database' },
      { id: 'DB-102', name: 'Firestore schema validation', description: 'Verifies blueprint matches document structure.', duration: 8, status: 'passed', category: 'Database' },
      { id: 'DB-103', name: 'Replication sync lag check', description: 'Ensures read-replica sync lag is under 150ms.', duration: 12, status: 'passed', category: 'Database' },
      { id: 'DB-104', name: 'Transactions rollbacks test', description: 'Verifies atomic rollback on capacity conflicts.', duration: 22, status: 'passed', category: 'Database' },
      { id: 'DB-105', name: 'Connection pool allocation', description: 'Validates high-traffic connection pool auto-scaling.', duration: 9, status: 'passed', category: 'Database' },
      { id: 'DB-106', name: 'Encryption at rest checks', description: 'Confirms cryptographic keys are rotated.', duration: 3, status: 'passed', category: 'Database' },

      // 2. Authentication (5 tests)
      { id: 'ATH-201', name: 'Firebase auth token generation', description: 'Validates JSON Web Token signature verification.', duration: 14, status: 'passed', category: 'Authentication' },
      { id: 'ATH-202', name: 'Session cooke secure attribute', description: 'Ensures cookies are HTTPOnly and SameSite=Strict.', duration: 5, status: 'passed', category: 'Authentication' },
      { id: 'ATH-203', name: 'OAuth redirect loop prevention', description: 'Verifies state keys on Jeddah callback router.', duration: 18, status: 'passed', category: 'Authentication' },
      { id: 'ATH-204', name: 'Multi-factor authentication routing', description: 'Validates SMS OTP bypass fallback logic.', duration: 11, status: 'passed', category: 'Authentication' },
      { 
        id: 'ATH-205', 
        name: 'Session timeout auto-revocation', 
        description: 'Validates JWT expiration resets after 14 days.', 
        duration: 35, 
        status: failingMode ? 'failed' : 'passed', // FAIL when failingMode is enabled!
        category: 'Authentication',
        expected: 'Status: Revoked (Code 401)',
        actual: 'Status: Idle / Connected (Code 200)',
        failureMessage: 'Session token was allowed to communicate after expiration date.'
      },

      // 3. Roles & Permissions (5 tests)
      { id: 'ROL-301', name: 'Customer access boundary checks', description: 'Restricts user from loading admin tables.', duration: 7, status: 'passed', category: 'Roles & Permissions' },
      { id: 'ROL-302', name: 'Staff cashier permissions', description: 'Allows cashier to check-in but blocks schema updates.', duration: 6, status: 'passed', category: 'Roles & Permissions' },
      { id: 'ROL-303', name: 'SuperAdmin credential validation', description: 'Grants root access to billing modules.', duration: 4, status: 'passed', category: 'Roles & Permissions' },
      { id: 'ROL-304', name: 'Public read restrictions', description: 'Blocks anonymous GET requests to queue phones.', duration: 12, status: 'passed', category: 'Roles & Permissions' },
      { id: 'ROL-305', name: 'Audit log creation trigger', description: 'Confirms log record on permission changes.', duration: 9, status: 'passed', category: 'Roles & Permissions' },

      // 4. Bookings & Capacity (8 tests)
      { id: 'BOK-401', name: 'Overbooking seat blocker', description: 'Prevents booking when capacity is 0.', duration: 15, status: 'passed', category: 'Bookings & Capacity' },
      { id: 'BOK-402', name: 'Walk-in capacity deduction', description: 'Deducts spots on the fly for POS tickets.', duration: 8, status: 'passed', category: 'Bookings & Capacity' },
      { id: 'BOK-403', name: 'Loyalty points credit calculation', description: 'Calculates 10% points credit on confirmed checkout.', duration: 11, status: 'passed', category: 'Bookings & Capacity' },
      { 
        id: 'BOK-404', 
        name: 'Cancellation 24-hour limit enforcement', 
        description: 'Verifies cancellation is blocked when start is under 24 hours.', 
        duration: 21, 
        status: failingMode ? 'failed' : 'passed', // FAIL when failingMode is enabled!
        category: 'Bookings & Capacity',
        expected: 'CancellationException: Not Allowed',
        actual: 'StatusChanged: Cancelled (Refunded)',
        failureMessage: 'A booking scheduled for 2 hours from now was successfully cancelled without staff override.'
      },
      { id: 'BOK-405', name: 'Refund voucher dispatch queue', description: 'Checks integration with Stripe credits api.', duration: 19, status: 'passed', category: 'Bookings & Capacity' },
      { id: 'BOK-406', name: 'Calendar invite dispatch trigger', description: 'Tests SMTP email relay to guest.', duration: 25, status: 'passed', category: 'Bookings & Capacity' },
      { id: 'BOK-407', name: 'Group pricing tier calculation', description: 'Calculates 15% discount for groups over 5.', duration: 6, status: 'passed', category: 'Bookings & Capacity' },
      { id: 'BOK-408', name: 'Time-slot overlap blocker', description: 'Prevents scheduling same instructor in two rooms.', duration: 14, status: 'passed', category: 'Bookings & Capacity' },

      // 5. Queue (7 tests)
      { id: 'QUE-501', name: 'Priority index auto-sort', description: 'Maintains strict chronological sorting.', duration: 9, status: 'passed', category: 'Queue' },
      { id: 'QUE-502', name: 'Average wait-time formula test', description: 'Tests average minute accumulator accuracy.', duration: 4, status: 'passed', category: 'Queue' },
      { id: 'QUE-503', name: 'Tablet action call trigger', description: 'Tests SMS notification to waiting walk-ins.', duration: 16, status: 'passed', category: 'Queue' },
      { id: 'QUE-504', name: 'Queue count sync on check-in', description: 'Increments waiting room count.', duration: 5, status: 'passed', category: 'Queue' },
      { id: 'QUE-505', name: 'Staff re-assignment updates', description: 'Verifies avatar swap on tablet layout.', duration: 8, status: 'passed', category: 'Queue' },
      { id: 'QUE-506', name: 'Auto-kick completed clients', description: 'Moves completed clients from waiting stack.', duration: 7, status: 'passed', category: 'Queue' },
      { id: 'QUE-507', name: 'Offline queue preservation', description: 'Retains queue stack state in localStorage on network cut.', duration: 13, status: 'passed', category: 'Queue' },

      // 6. Pieces (6 tests)
      { id: 'PCS-601', name: 'Pottery item creation on checkout', description: 'Spawns piece record automatically.', duration: 12, status: 'passed', category: 'Pieces' },
      { id: 'PCS-602', name: 'Drying days counter incrementer', description: 'Increments elapsed days at midnight.', duration: 3, status: 'passed', category: 'Pieces' },
      { id: 'PCS-603', name: 'Overdue warning threshold alert', description: 'Triggers board highlighting after 10 days.', duration: 5, status: 'passed', category: 'Pieces' },
      { id: 'PCS-604', name: 'Ready-for-pickup email trigger', description: 'Triggers SMS on ready state.', duration: 18, status: 'passed', category: 'Pieces' },
      { 
        id: 'PCS-605', 
        name: 'Unassigned shelf storage warning', 
        description: 'Errors out when ready piece is not assigned a location.', 
        duration: 11, 
        status: failingMode ? 'failed' : 'passed', // FAIL when failingMode is enabled!
        category: 'Pieces',
        expected: 'ValidationError: Storage shelf is required for READY state',
        actual: 'Status: Ready for Collection (Location: null)',
        failureMessage: 'A pottery piece was marked ready without a physical shelf coordinates.'
      },
      { id: 'PCS-606', name: 'Archival status cleanup script', description: 'Hides collected pieces after 30 days.', duration: 15, status: 'passed', category: 'Pieces' },

      // 7. Data Integrity (5 tests)
      { id: 'INT-701', name: 'Foreign key cascades validator', description: 'Ensures deleting workshop drops scheduled sessions.', duration: 16, status: 'passed', category: 'Data Integrity' },
      { id: 'INT-702', name: 'Negative balance blocker', description: 'Prevents refunding more than total booking cost.', duration: 4, status: 'passed', category: 'Data Integrity' },
      { id: 'INT-703', name: 'String trimming inputs sanitization', description: 'Removes tags and trailing whitespaces.', duration: 3, status: 'passed', category: 'Data Integrity' },
      { id: 'INT-704', name: 'Unique reference index check', description: 'Enforces unique 8-char reservation keys.', duration: 8, status: 'passed', category: 'Data Integrity' },
      { id: 'INT-705', name: 'Orphaned pieces diagnostics', description: 'Alerts on pieces with non-existing booking IDs.', duration: 14, status: 'passed', category: 'Data Integrity' },

      // 8. Routes (5 tests)
      { id: 'RUT-801', name: 'Client index static page load', description: 'Verifies index.html yields HTTP 200.', duration: 5, status: 'passed', category: 'Routes' },
      { id: 'RUT-802', name: 'API health end-point response', description: 'Ensures /api/health responds with status ok.', duration: 4, status: 'passed', category: 'Routes' },
      { id: 'RUT-803', name: 'Admin router authorization shield', description: 'Redirects non-staff attempts with 403.', duration: 11, status: 'passed', category: 'Routes' },
      { id: 'RUT-804', name: '404 custom handler fallback', description: 'Renders custom error page on bad requests.', duration: 6, status: 'passed', category: 'Routes' },
      { id: 'RUT-805', name: 'CORS policy configurations', description: 'Blocks foreign cross-site headers.', duration: 8, status: 'passed', category: 'Routes' },
    ];
  }, [failingMode]);

  // Group tests by category
  const categorizedTests: Record<string, TestResult[]> = useMemo(() => {
    const groups: Record<string, TestResult[]> = {};
    allTests.forEach((t) => {
      if (!groups[t.category]) groups[t.category] = [];
      if (failuresOnly && t.status === 'passed') return; // skip if failuresOnly
      groups[t.category].push(t);
    });
    return groups;
  }, [allTests, failuresOnly]);

  const stats = useMemo(() => {
    const total = allTests.length;
    const failed = failingMode ? 3 : 0;
    const passed = total - failed;
    const duration = allTests.reduce((sum, curr) => sum + curr.duration, 0);
    return { total, passed, failed, duration };
  }, [allTests, failingMode]);

  return (
    <div className="p-6 space-y-6 text-left bg-brand-cream min-h-full">
      
      {/* Header and Simulator Mode */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-brand-clay/60">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-charcoal">System Health & Test Suite</h1>
          <p className="text-xs text-brand-charcoal/60 mt-1">
            Execute unit and integration tests covering databases, authentication boundaries, capacity deductions, and schemas.
          </p>
        </div>

        {/* Test Suite Fail Simulator Switch */}
        <div className="bg-white border border-brand-clay/70 p-1.5 rounded-xl flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[10px] font-bold text-brand-sage uppercase tracking-wider">TEST OUTCOMES:</span>
          <button
            onClick={() => {
              setFailingMode(false);
              setFailuresOnly(false);
            }}
            className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              !failingMode ? 'bg-green-600 text-brand-cream' : 'text-brand-charcoal/60'
            }`}
          >
            All Passing (47/47)
          </button>
          <button
            onClick={() => {
              setFailingMode(true);
            }}
            className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              failingMode ? 'bg-brand-terracotta text-brand-cream' : 'text-brand-charcoal/60'
            }`}
          >
            Show Failures (3/47)
          </button>
        </div>
      </div>

      {/* OVERALL STATUS BANNER - requested in prompt */}
      {isRunning ? (
        /* Running Progress State Banner */
        <div className="bg-brand-sand border border-brand-clay p-5 rounded-2xl space-y-3 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold text-brand-charcoal">
            <span className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-brand-terracotta animate-spin" />
              <span>Running automated integrity suite...</span>
            </span>
            <span>Test {runProgress} of 47</span>
          </div>
          {/* Progress Bar container */}
          <div className="w-full bg-brand-cream border border-brand-clay/40 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-brand-terracotta h-full rounded-full transition-all duration-100"
              style={{ width: `${(runProgress / 47) * 100}%` }}
            ></div>
          </div>
        </div>
      ) : stats.failed > 0 ? (
        /* Red Failing Variant Banner */
        <div className="bg-red-50 border-2 border-brand-terracotta p-5 rounded-2xl flex items-start gap-4 shadow-sm">
          <div className="h-12 w-12 rounded-xl bg-brand-terracotta text-brand-cream flex items-center justify-center shrink-0">
            <ShieldAlert className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-red-900">3 Integration Tests Failing</h3>
            <p className="text-xs text-red-800 mt-1 leading-relaxed font-semibold">
              Warning: critical permission and validation checks failed on Sunday, July 19. Session hijack and unassigned storage shelfs detected. Please review logs below.
            </p>
          </div>
        </div>
      ) : (
        /* Green Passing Variant Banner */
        <div className="bg-green-50 border-2 border-green-500 p-5 rounded-2xl flex items-start gap-4 shadow-sm animate-in fade-in duration-300">
          <div className="h-12 w-12 rounded-xl bg-green-500 text-brand-cream flex items-center justify-center shrink-0">
            <CheckCircle className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-green-900">All systems operational — 47/47 tests passed</h3>
            <p className="text-xs text-green-800 mt-1 leading-relaxed font-semibold">
              All client sandboxes, PostgreSQL Cloud SQL connections, capacity constraints, and transactional routers compiled cleanly. Zero anomalies found.
            </p>
          </div>
        </div>
      )}

      {/* Summary Stat Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-brand-clay/70 p-4 rounded-xl text-left">
          <span className="text-[10px] font-bold text-brand-charcoal/50 uppercase block">Passed tests</span>
          <span className="text-2xl font-extrabold text-green-600 block mt-1">{stats.passed} specs</span>
        </div>

        <div className="bg-white border border-brand-clay/70 p-4 rounded-xl text-left">
          <span className="text-[10px] font-bold text-brand-charcoal/50 uppercase block">Failed tests</span>
          <span className={`text-2xl font-extrabold block mt-1 ${stats.failed > 0 ? 'text-brand-terracotta animate-pulse' : 'text-brand-charcoal/30'}`}>
            {stats.failed} specs
          </span>
        </div>

        <div className="bg-white border border-brand-clay/70 p-4 rounded-xl text-left">
          <span className="text-[10px] font-bold text-brand-charcoal/50 uppercase block">Skipped checks</span>
          <span className="text-2xl font-extrabold text-brand-charcoal/35 block mt-1">0 specs</span>
        </div>

        <div className="bg-white border border-brand-clay/70 p-4 rounded-xl text-left">
          <span className="text-[10px] font-bold text-brand-charcoal/50 uppercase block">Agg. Duration</span>
          <span className="text-2xl font-extrabold text-brand-charcoal block mt-1">{stats.duration} ms</span>
        </div>
      </div>

      {/* Run suite button bar */}
      <div className="flex justify-between items-center bg-white border border-brand-clay/70 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={triggerRunSuite}
            disabled={isRunning}
            className="cursor-pointer bg-brand-charcoal text-brand-cream hover:bg-brand-charcoal/90 disabled:opacity-40 font-bold text-xs px-5 py-3 rounded-xl flex items-center gap-2 shadow-sm transition-all"
          >
            <Play className="h-4 w-4 text-brand-terracotta fill-brand-terracotta" />
            <span>Run All Tests</span>
          </button>
          
          <p className="text-xs text-brand-charcoal/60 font-semibold hidden sm:block">
            Last audited: <span className="font-bold">{lastRunTime}</span>
          </p>
        </div>

        {/* Filters and export controls */}
        <div className="flex items-center gap-2">
          {/* Failures Only Toggle */}
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
            onClick={() => alert("Exported test logs package 'arty_test_suite_logs.json'!")}
            className="cursor-pointer bg-brand-cream hover:bg-brand-sand border border-brand-clay text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1"
          >
            <Download className="h-4 w-4" />
            <span>Export Results</span>
          </button>
        </div>
      </div>

      {/* COLLAPSIBLE CATEGORIES AREA - requested in prompt */}
      <div className="space-y-4">
        {Object.entries(categorizedTests).map(([cat, list]) => {
          if (list.length === 0) return null;
          const isCollapsed = collapsedCats[cat];
          const hasFailureInCat = list.some(t => t.status === 'failed');

          return (
            <div key={cat} className="bg-white border border-brand-clay/70 rounded-2xl overflow-hidden shadow-2xs">
              
              {/* Category Header */}
              <div 
                onClick={() => toggleCategory(cat)}
                className="cursor-pointer p-4 bg-brand-cream/35 hover:bg-brand-sand/20 border-b border-brand-clay/40 flex justify-between items-center"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${hasFailureInCat ? 'bg-brand-terracotta animate-pulse' : 'bg-green-500'}`}></span>
                  <h3 className="font-display font-extrabold text-sm text-brand-charcoal">{cat} Tests</h3>
                  <span className="text-[10px] text-brand-charcoal/40 font-bold">({list.length} specs)</span>
                </div>

                <button className="text-brand-charcoal/50">
                  {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
              </div>

              {/* Category Test Rows List */}
              {!isCollapsed && (
                <div className="divide-y divide-brand-clay/30">
                  {list.map((t) => (
                    <div key={t.id} className="p-4 space-y-3 hover:bg-brand-sand/5 transition-colors text-xs text-left">
                      
                      {/* Row Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-2.5">
                          {t.status === 'passed' ? (
                            <CheckCircle className="h-4.5 w-4.5 text-green-500 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-4.5 w-4.5 text-brand-terracotta shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="font-bold text-brand-charcoal">
                              {t.name} <span className="font-mono text-[9px] text-brand-sage ml-1 border border-brand-clay/50 px-1.5 py-0.2 rounded bg-brand-sand">{t.id}</span>
                            </p>
                            <p className="text-[11px] text-brand-charcoal/65 font-medium mt-0.5">{t.description}</p>
                          </div>
                        </div>

                        {/* Duration & re-run action */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px] font-mono font-bold text-brand-charcoal/40">{t.duration} ms</span>
                          <button 
                            type="button"
                            onClick={() => alert(`Re-running test ${t.id}... OK.`)}
                            className="p-1 hover:bg-brand-sand rounded text-brand-charcoal/40 hover:text-brand-terracotta cursor-pointer"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* EXPANDED FAILED SPEC ROW: Expected vs Actual container - requested in prompt */}
                      {t.status === 'failed' && (
                        <div className="bg-red-50/50 border border-red-200 p-4 rounded-xl space-y-2.5 ml-7">
                          <div className="flex items-center gap-1.5 text-red-700 font-extrabold text-[10px] uppercase tracking-wider">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>Assertion Failure: {t.failureMessage}</span>
                          </div>

                          {/* Side-by-side expected vs actual code block */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-mono">
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-brand-charcoal/50 block">Expected:</span>
                              <pre className="bg-brand-cream border border-brand-clay p-2.5 rounded-lg text-green-700 block whitespace-pre-wrap leading-relaxed font-bold">
                                {t.expected}
                              </pre>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-brand-charcoal/50 block">Actual:</span>
                              <pre className="bg-brand-cream border border-red-300 p-2.5 rounded-lg text-red-600 block whitespace-pre-wrap leading-relaxed font-bold">
                                {t.actual}
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
