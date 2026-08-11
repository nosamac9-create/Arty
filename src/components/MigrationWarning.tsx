/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { checkMigrations, MigrationCheckResult } from '../lib/migrationCheck';

/**
 * A visible banner when the database is missing a migration.
 *
 * Deliberately not a console log: a missing migration otherwise surfaces much
 * later as an unrelated failure — a booking that quietly does not save — and
 * costs an hour of misdirected debugging. It names the file to run.
 *
 * Dismissible, because it is developer-facing and should not block the app.
 */
export const MigrationWarning: React.FC = () => {
  const [result, setResult] = useState<MigrationCheckResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkMigrations().then(r => { if (!cancelled) setResult(r); });
    return () => { cancelled = true; };
  }, []);

  if (!result || result.ok || result.skipped || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-[100]">
      <div className="bg-red-50 border-2 border-red-400 rounded-2xl shadow-xl p-4 text-left space-y-2">

        <div className="flex items-start gap-2.5">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-sm text-red-900">Database is missing a migration</p>
            <p className="text-[11px] text-red-800/80 mt-0.5 leading-relaxed">
              Parts of the app will fail until this is applied. Run the file below in the
              Supabase SQL editor.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="p-1 rounded-lg text-red-700/60 hover:bg-red-100 cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="space-y-1 text-[11px] font-semibold text-red-900 bg-white/70 border border-red-200 rounded-xl p-2.5">
          {result.problems.map(problem => (
            <li key={problem} className="font-mono leading-relaxed">{problem}</li>
          ))}
        </ul>

        <p className="text-[11px] font-bold text-red-900">
          Run, in order:{' '}
          <span className="font-mono">
            {result.missingMigrations.map(m => `supabase/migrations/${m}`).join(', ')}
          </span>
        </p>

      </div>
    </div>
  );
};
