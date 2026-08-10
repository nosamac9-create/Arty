/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, LogOut } from 'lucide-react';
import { passwordChecklist, validatePasswordRule, validatePasswordConfirmation } from '../utils/validation';

/**
 * Shown instead of the console while a staff account is still on the password
 * it was provisioned with.
 *
 * This sits in the routing guard rather than on the sign-in form: the session
 * already exists by the time it is needed, so the sign-in form has been
 * unmounted. The console is not rendered until the password is replaced.
 */
export const StaffPasswordChangeSection: React.FC = () => {
  const { currentStaff, changeStaffPassword, logoutStaff } = useApp();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setError(null);

    const strength = validatePasswordRule(password);
    if (!strength.valid) {
      setError(strength.error!);
      return;
    }

    const match = validatePasswordConfirmation(password, confirmPassword);
    if (!match.valid) {
      setError(match.error!);
      return;
    }

    setIsSaving(true);
    try {
      const result = await changeStaffPassword(password);
      if (!result.success) {
        setError(result.error || 'Could not save the new password.');
        return;
      }
    } catch (err: any) {
      // Anything that throws is reported rather than leaving the button stuck.
      setError(err?.message || 'Could not reach the authentication service.');
      return;
    } finally {
      setIsSaving(false);
    }

    // The console opens on the next render: passwordIsTemporary is now false.
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-brand-cream p-6">
      <div className="w-full max-w-md bg-white border border-brand-clay rounded-3xl p-8 shadow-sm text-left space-y-5">

        <div className="h-12 w-12 rounded-2xl bg-brand-charcoal text-brand-cream flex items-center justify-center">
          <ShieldCheck className="h-6 w-6" />
        </div>

        <div>
          <h1 className="font-display text-2xl font-bold text-brand-charcoal">Choose a new password</h1>
          <p className="text-xs text-brand-charcoal/65 mt-1.5 leading-relaxed">
            {currentStaff?.name ? `${currentStaff.name}, this ` : 'This '}
            account is still using the password it was set up with. Choose your own
            before opening the console.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-brand-charcoal/80">New password *</label>
            <input
              type="password"
              required
              autoFocus
              placeholder="••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null); }}
              className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3 px-4 text-sm font-semibold text-brand-charcoal"
            />
            <ul className="space-y-0.5 pt-1">
              {passwordChecklist(password).map(item => (
                <li
                  key={item.label}
                  className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                    item.met ? 'text-brand-sage' : 'text-brand-charcoal/45'
                  }`}
                >
                  <span>{item.met ? '✓' : '•'}</span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-brand-charcoal/80">Confirm password *</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setError(null); }}
              className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3 px-4 text-sm font-semibold text-brand-charcoal"
            />
          </div>

          {error && (
            <p className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full cursor-pointer rounded-xl bg-brand-terracotta py-3.5 text-sm font-bold text-brand-cream hover:bg-brand-terracotta-hover transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save and open the console'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => logoutStaff()}
          className="text-[11px] font-bold text-brand-charcoal/55 hover:text-brand-terracotta cursor-pointer inline-flex items-center gap-1.5"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign out instead</span>
        </button>

      </div>
    </div>
  );
};
