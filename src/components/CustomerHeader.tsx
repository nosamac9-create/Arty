/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Palette, Coffee, Menu, X, User, Calendar, Flame } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { LanguageToggle } from './LanguageToggle';

export const CustomerHeader: React.FC = () => {
  const { customerTab, setCustomerTab, currentUser, setWorkshopsInitialCategory } = useApp();
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // shortLabel is what fits under an icon in the mobile tab bar.
  const navItems = [
    { id: 'home', label: t('Home', 'الرئيسية'), shortLabel: t('Home', 'الرئيسية'), icon: Coffee },
    { id: 'workshops', label: t('Workshops', 'الورش'), shortLabel: t('Workshops', 'الورش'), icon: Palette },
    { id: 'my-bookings', label: t('My Bookings', 'حجوزاتي'), shortLabel: t('Bookings', 'حجوزاتي'), icon: Calendar },
    { id: 'my-pieces', label: t('My Pieces', 'أعمالي'), shortLabel: t('Pieces', 'أعمالي'), icon: Flame },
    {
      id: 'auth',
      label: currentUser ? t('My Account', 'حسابي') : t('Login', 'تسجيل الدخول'),
      shortLabel: t('Account', 'حسابي'),
      icon: User
    },
  ] as const;

  const handleNavClick = (tabId: typeof navItems[number]['id']) => {
    // A general nav click always means "browse everything" — clears any
    // category filter left over from a deep link like the birthday band.
    if (tabId === 'workshops') setWorkshopsInitialCategory('All');
    setCustomerTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-brand-clay bg-brand-cream/92 backdrop-blur-md">
        <div className="mx-auto flex h-[78px] max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-12">

          {/* Wordmark */}
          <button
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-3 text-left group focus:outline-none cursor-pointer shrink-0"
          >
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[14px] bg-brand-terracotta text-brand-cream font-semibold text-[17px] transition-transform duration-300 group-hover:-rotate-6">
              A
            </div>
            <div className="leading-none">
              <span className="block font-display text-[18px] font-semibold tracking-tight text-brand-charcoal">Arty Café</span>
              <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-brand-sage">
                Jeddah Art &amp; Clay
              </span>
            </div>
          </button>

          {/* Desktop navigation — plain words, weight marks the active one */}
          <nav className="hidden lg:flex items-center gap-[30px]">
            {navItems.map(item => {
              const isActive = customerTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`text-sm transition-colors cursor-pointer ${
                    isActive
                      ? 'font-semibold text-brand-charcoal'
                      : 'font-normal text-brand-ink hover:text-brand-charcoal'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <LanguageToggle />

            <button
              onClick={() => handleNavClick('workshops')}
              className="hidden sm:block cursor-pointer rounded-[14px] bg-brand-terracotta px-[22px] py-3 text-sm font-semibold text-brand-cream shadow-button transition-colors hover:bg-brand-terracotta-hover active:scale-[0.98]"
            >
              {t('Book Now', 'احجز الآن')}
            </button>

            {/* Mobile menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-brand-charcoal hover:bg-brand-sand focus:outline-none cursor-pointer"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-brand-clay bg-brand-cream px-4 py-4 space-y-1 shadow-card-sm animate-in fade-in slide-in-from-top-4 duration-200">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = customerTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-base cursor-pointer ${
                    isActive
                      ? 'bg-brand-sand font-semibold text-brand-charcoal'
                      : 'font-medium text-brand-ink hover:bg-brand-sand/60'
                  }`}
                >
                  <Icon className="h-5 w-5 text-brand-sage" />
                  {item.label}
                </button>
              );
            })}
            <button
              onClick={() => handleNavClick('workshops')}
              className="mt-2 w-full cursor-pointer rounded-2xl bg-brand-terracotta px-4 py-3.5 text-sm font-semibold text-brand-cream"
            >
              Book Now
            </button>
          </div>
        )}
      </header>

      {/* Mobile bottom tab bar — the design's primary mobile navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-brand-clay bg-brand-cream/95 backdrop-blur-md px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = customerTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold cursor-pointer transition-colors ${
                  isActive ? 'text-brand-terracotta' : 'text-brand-muted'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${isActive ? '' : 'opacity-70'}`} />
                <span>{item.shortLabel || item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export const CustomerFooter: React.FC = () => {
  const { setCustomerTab, goToStaffLogin, currentStaff, returnToStaffConsole, setWorkshopsInitialCategory } = useApp();
  const { t } = useLanguage();

  const link = 'text-start transition-colors hover:text-brand-charcoal cursor-pointer';
  const goToWorkshops = () => {
    setWorkshopsInitialCategory('All');
    setCustomerTab('workshops');
  };

  return (
    /* pb clears the mobile tab bar so the last line is never hidden behind it. */
    <footer className="border-t border-brand-clay bg-white pt-16 pb-24 lg:pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4 md:gap-8">

          {/* Identity */}
          <div className="space-y-4 md:pe-8">
            <div className="flex items-center gap-3">
              <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[14px] bg-brand-terracotta font-semibold text-[17px] text-brand-cream">
                A
              </div>
              <div className="leading-none">
                <span className="block font-display text-[18px] font-semibold tracking-tight text-brand-charcoal">Arty Café</span>
                <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-brand-sage">
                  {t('Jeddah Art & Clay', 'جدة للفن والطين')}
                </span>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-brand-ink">
              {t(
                'Jeddah’s cozy creative sanctuary. Crafting memories, pouring fine coffee, and molding mud into masterworks since 2021.',
                'ملاذ جدة الإبداعي. نصنع الذكريات، ونقدّم قهوة مختصة، ونحوّل الطين إلى تحف منذ ٢٠٢١.'
              )}
            </p>
          </div>

          {/* Explore */}
          <div>
            <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">
              {t('Explore', 'تصفّح')}
            </h3>
            <ul className="space-y-2.5 text-sm text-brand-ink">
              <li><button onClick={goToWorkshops} className={link}>{t('Pottery Workshops', 'ورش الفخار')}</button></li>
              <li><button onClick={goToWorkshops} className={link}>{t('Acrylic Painting', 'الرسم بالأكريليك')}</button></li>
              <li><button onClick={goToWorkshops} className={link}>{t('Kids & Couples Classes', 'جلسات الأطفال والأزواج')}</button></li>
              <li><button onClick={() => setCustomerTab('my-bookings')} className={link}>{t('My Bookings', 'حجوزاتي')}</button></li>
            </ul>
          </div>

          {/* Hours */}
          <div>
            <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">
              {t('Hours', 'أوقات العمل')}
            </h3>
            <ul className="space-y-2 text-sm text-brand-ink">
              <li>{t('Saturday – Thursday', 'السبت – الخميس')}</li>
              <li className="font-semibold text-brand-charcoal ltr-numerals">09:00 AM – 11:00 PM</li>
              <li className="pt-1">{t('Friday', 'الجمعة')}</li>
              <li className="font-semibold text-brand-charcoal ltr-numerals">02:00 PM – 11:00 PM</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">
              {t('Say Hello', 'تواصل معنا')}
            </h3>
            <p className="text-sm leading-relaxed text-brand-ink">
              {t('3331 Ahmad Al Attas, Al Zahra District, Jeddah 23521, KSA', '3331 أحمد العطاس، حي الزهراء، جدة 23521، المملكة العربية السعودية')}
            </p>
            <a href="tel:+966126543210" className="mt-3 block text-sm font-semibold text-brand-terracotta hover:underline ltr-numerals">
              +966 12 654 3210
            </a>
            <a href="mailto:hello@artycafe.sa" className="mt-1 block text-xs text-brand-muted hover:text-brand-charcoal">
              hello@artycafe.sa
            </a>
          </div>

        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-brand-clay pt-8 text-xs text-brand-muted sm:flex-row">
          <p>{t('© 2026 Arty Café Jeddah. All rights reserved.', '© ٢٠٢٦ آرتي كافيه جدة. جميع الحقوق محفوظة.')}</p>
          <div className="flex items-center gap-6">
            <span className="cursor-pointer hover:text-brand-charcoal">Instagram</span>
            <span className="cursor-pointer hover:text-brand-charcoal">X (Twitter)</span>
            <span className="cursor-pointer hover:text-brand-charcoal">TikTok</span>

            {/* The only way into the staff area. Signing in is still required —
                this opens the staff login, it grants nothing. */}
            {currentStaff ? (
              <button
                type="button"
                onClick={() => returnToStaffConsole()}
                className="cursor-pointer font-semibold text-brand-terracotta hover:underline"
              >
                {t('Back to Staff Console', 'العودة إلى لوحة الموظفين')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goToStaffLogin()}
                className="cursor-pointer hover:text-brand-charcoal"
              >
                {t('Staff Login', 'دخول الموظفين')}
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
