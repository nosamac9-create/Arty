/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, Calendar, Box, Flame, Compass, Clock, LogIn, Hash , CheckCircle2, Check } from 'lucide-react';
import { PotteryPiece, stageCustomerLabel, migrateLegacyPieceStatus } from '../types';
import { formatDateTime } from '../utils/calendarConfig';
import Reveal from './ui/Reveal';
import { ScrollReveal } from './ui/ScrollReveal';
import { AppImage } from './ui/AppImage';

export const MyPiecesSection: React.FC = () => {
  const {
    pieces, setCustomerTab, currentUser, notifications, markNotificationAsRead,
    pipelineStages, workshops
  } = useApp();

  // Filter pieces strictly for the logged-in customer
  const userPieces = React.useMemo(() => {
    if (!currentUser) return [];
    return pieces.filter(p => {
      if (p.customerId && currentUser.id && p.customerId === currentUser.id) return true;
      if (p.customerPhone && currentUser.phone) {
        return p.customerPhone.replace(/\D/g, '') === currentUser.phone.replace(/\D/g, '');
      }
      if (p.customerName && currentUser.name) {
        return p.customerName.toLowerCase().trim() === currentUser.name.toLowerCase().trim();
      }
      return false;
    });
  }, [pieces, currentUser]);

  // Filter notifications for current customer
  const customerNotifs = React.useMemo(() => {
    if (!currentUser) return [];
    return notifications
      .filter(n => n.type === 'customer' && n.customerPhone && currentUser.phone && n.customerPhone.replace(/\D/g, '') === currentUser.phone.replace(/\D/g, '') && !n.isRead)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [notifications, currentUser]);

  /**
   * Customer-facing stages come from Settings → Piece Pipeline Stages: the ones
   * marked visible to the customer, in the configured order, using the customer
   * label where one is set.
   */
  const customerStages = React.useMemo(
    () => [...pipelineStages]
      .filter(stage => stage.visibleToCustomer)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [pipelineStages]
  );

  const STAGES = customerStages.length > 0
    ? customerStages.map(stageCustomerLabel)
    : ['Created', 'First Burn and Colored', 'Ready for Pickup'];

  /**
   * The tracker reads its position from the configured stages rather than a
   * hardcoded list — renaming or reordering a stage in Settings moves the
   * customer's tracker with it. A retired name on an older piece is mapped onto
   * the stage that replaced it.
   *
   * 'Collected' (and any other stage marked not customer-visible) has no dot
   * of its own — Picked Up is a final status, not a fourth progress step — so
   * it is read as "past the last visible stage" rather than "not found".
   */
  const getStageIndex = (status: PotteryPiece['status'] | string): number => {
    const current = migrateLegacyPieceStatus(status);
    const index = customerStages.findIndex(stage => stage.name === current);
    if (index >= 0) return index;
    return current === 'Collected' ? customerStages.length : 0;
  };

  /**
   * The photo the customer sees is the workshop's, not the studio's own shot of
   * the piece: that upload is a working record for the shelf, taken mid-process
   * and never meant for the customer.
   */
  /**
   * No stand-in photograph. A stock pottery shot used to fill this space, which
   * showed the customer someone else's work in place of their own; an empty
   * frame is honest about having no picture to show.
   */
  const PIECE_PLACEHOLDER = '';

  const customerImageFor = (piece: PotteryPiece): string => {
    const byId = piece.workshopId
      ? workshops.find(w => w.id === piece.workshopId)
      : undefined;
    // Older pieces predate the workshop link and only carry the name.
    const byName = !byId && piece.workshopName
      ? workshops.find(
          w => w.title.trim().toLowerCase() === piece.workshopName.trim().toLowerCase()
        )
      : undefined;
    return (byId || byName)?.image || PIECE_PLACEHOLDER;
  };

  /**
   * Broken is an internal handling state, so the customer tracker keeps showing the
   * last stage the piece actually reached rather than resetting to Created. The
   * customer is told to contact the café through the notification instead.
   */
  const getCustomerStageIndex = (piece: PotteryPiece): number => {
    if (piece.status !== 'Broken') return getStageIndex(piece.status);

    const lastKnown = [...(piece.history || [])]
      .reverse()
      .find(h => h.status !== 'Broken');

    return lastKnown ? getStageIndex(lastKnown.status) : 0;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300 text-start">
      
      {/* Header block */}
      <div className="pb-8 border-b border-brand-clay mb-8">
        <Reveal index={0}>
          <h1 className="font-display text-3xl font-semibold text-brand-charcoal">My Pottery Creations</h1>
        </Reveal>
        <Reveal index={1}>
          <p className="text-sm text-brand-ink mt-1">
            Track your handcrafted clay pieces from creation through their first burn and coloring, to pickup.
          </p>
        </Reveal>
      </div>

      {/* Customer Notifications Panel */}
      {currentUser && customerNotifs.length > 0 && (
        <div className="mb-8 space-y-3">
          {customerNotifs.map((n) => (
            <div
              key={n.id}
              className={`p-5 rounded-2xl border text-start flex justify-between items-start gap-4 transition-all duration-300 animate-in fade-in slide-in-from-left-4 ${
                n.highlighted
                  ? 'bg-gradient-to-r from-amber-50 to-brand-sand/30 border-brand-terracotta ring-4 ring-brand-terracotta/5 shadow-card-sm'
                  : 'bg-brand-cream border-brand-clay/70 shadow-card-sm'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  n.highlighted ? 'bg-brand-terracotta text-brand-cream animate-pulse' : 'bg-brand-sand text-brand-sage'
                }`}>
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h4 className={`text-sm font-semibold ${n.highlighted ? 'text-brand-terracotta' : 'text-brand-charcoal'}`}>
                    {n.title}
                  </h4>
                  <p className="text-xs text-brand-ink mt-1 leading-relaxed">
                    {n.message}
                  </p>
                  <span className="text-[9px] text-brand-charcoal/45 font-semibold block mt-1.5">
                    {formatDateTime(n.timestamp)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => markNotificationAsRead(n.id)}
                className="text-[10px] font-semibold text-brand-sage hover:text-brand-terracotta bg-brand-sand/50 hover:bg-brand-sand px-3 py-1.5 rounded-lg border border-brand-clay transition-colors cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Not Logged In State */}
      {!currentUser ? (
        <ScrollReveal
          once
          viewOptions={{ once: true, amount: 0.3, margin: '0px 0px -80px 0px' }}
          transition={{ delay: 0, duration: 0.5, ease: 'easeOut' }}
          variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
        >
        <div className="bg-white border border-brand-clay rounded-[28px] py-16 px-6 text-center max-w-md mx-auto space-y-4 shadow-card-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-terracotta/10 text-brand-terracotta">
            <Flame className="h-7 w-7" />
          </div>
          <div>
            <h3 className="font-display text-xl font-semibold text-brand-charcoal">Log in to view your pieces</h3>
            <p className="text-sm text-brand-ink mt-2 leading-relaxed">
              Log in with your account or phone number to see live status updates for your ceramic pieces, kiln firing, and pickup dates.
            </p>
          </div>
          <button
            onClick={() => setCustomerTab('auth')}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-terracotta px-6 py-3 text-xs font-semibold text-brand-cream hover:bg-brand-terracotta-hover shadow-card-sm cursor-pointer"
          >
            <LogIn className="h-4 w-4" />
            <span>Sign In to Account</span>
          </button>
        </div>
        </ScrollReveal>
      ) : userPieces.length === 0 ? (
        /* Empty State for Logged-In User */
        <ScrollReveal
          once
          viewOptions={{ once: true, amount: 0.3, margin: '0px 0px -80px 0px' }}
          transition={{ delay: 0, duration: 0.5, ease: 'easeOut' }}
          variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
        >
        <div className="bg-white border border-brand-clay rounded-[28px] py-16 px-6 text-center max-w-md mx-auto space-y-4 shadow-card-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-terracotta/10 text-brand-terracotta">
            <Box className="h-7 w-7" />
          </div>
          <div>
            <h3 className="font-display text-xl font-semibold text-brand-charcoal">No pottery pieces registered yet</h3>
            <p className="text-sm text-brand-ink mt-2 leading-relaxed">
              Your handcrafted pieces will appear here once logged by café staff after your workshop session!
            </p>
          </div>
          <button
            onClick={() => setCustomerTab('workshops')}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-terracotta px-5 py-3 text-xs font-semibold text-brand-cream hover:bg-brand-terracotta-hover shadow-card-sm cursor-pointer"
          >
            <Compass className="h-4 w-4" />
            <span>Explore Workshops</span>
          </button>
        </div>
        </ScrollReveal>
      ) : (
        /* Grid of Piece Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {userPieces.map((p, cardIndex) => {
            const currentStageIdx = getCustomerStageIndex(p);
            const isReady = p.status === 'Ready for Pickup';

            const isBroken = p.status === 'Broken';

            return (
              <ScrollReveal
                key={p.id}
                once
                viewOptions={{ once: true, amount: 0.3, margin: '0px 0px -80px 0px' }}
                transition={{ delay: cardIndex * 0.12, duration: 0.5, ease: 'easeOut' }}
                variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
              >
              <div
                className={`relative bg-brand-cream rounded-[32px] p-6 shadow-card shadow-brand-charcoal/5 border flex flex-col justify-between transition-all duration-300 ${
                  isBroken
                    ? 'border-2 border-red-300 ring-4 ring-red-100'
                    : isReady
                      ? 'border-2 border-brand-terracotta ring-4 ring-brand-terracotta/5'
                      : 'border-brand-clay'
                }`}
              >
                
                {/* Ready Banner */}
                {isReady && !isBroken && (
                  <div className="absolute top-0 left-0 right-0 flex items-center justify-center gap-1.5 bg-brand-terracotta text-brand-cream text-center text-xs font-semibold py-2 rounded-t-[30px] tracking-wider">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Ready! Ready for pickup at the Arty Café shelf.</span>
                  </div>
                )}

                {/* Broken Banner — states the status plainly, with no internal notes */}
                {isBroken && (
                  <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-center text-xs font-semibold py-2 rounded-t-[30px] tracking-wider">
                    Broken — please contact Arty Café
                  </div>
                )}

                {/* Piece Image and Info */}
                <div className={`space-y-4 ${isReady || isBroken ? 'pt-6' : ''}`}>
                  <div className="aspect-video w-full rounded-2xl overflow-hidden bg-brand-sand border border-brand-clay">
                    <AppImage
                      src={customerImageFor(p)}
                      alt={p.name}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  
                  <div className="text-start space-y-1.5">
                    <div className="flex items-center justify-between">
                      {p.pieceCode ? (
                        <span className="text-[10px] font-mono font-semibold bg-brand-sand/80 text-brand-terracotta px-2 py-0.5 rounded border border-brand-clay flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          Code: {p.pieceCode}
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono font-semibold bg-brand-sand px-2 py-0.5 rounded border border-brand-clay text-brand-muted">
                          ID: {p.id}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold text-brand-sage flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Created: {p.dateCreated}
                      </span>
                    </div>

                    <h3 className="font-display text-xl font-semibold text-brand-charcoal line-clamp-1">{p.name}</h3>
                    <p className="text-xs font-semibold text-brand-terracotta line-clamp-1">{p.workshopName}</p>

                    {/* Expected Ready Date */}
                    {p.expectedReadyDate && (
                      <div className="pt-2 flex items-center gap-1.5 text-xs text-brand-ink font-semibold bg-brand-sand/30 p-2 rounded-xl border border-brand-clay">
                        <Clock className="h-3.5 w-3.5 text-brand-terracotta" />
                        <span>Expected Ready: {p.expectedReadyDate}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Broken status notice — no internal damage note is shown */}
                {isBroken && (
                  <div className="mt-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-start">
                    <p className="text-xs font-semibold text-red-800">Status: Broken</p>
                    <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">
                      Unfortunately this piece was damaged. Please contact Arty Café so our team can assist you with a replacement.
                    </p>
                  </div>
                )}

                {/* Progress Tracker Bar */}
                <div className="mt-6 pt-5 border-t border-brand-clay space-y-4">
                  <div className="relative flex items-center justify-between">
                    <div className="absolute left-2.5 right-2.5 top-1/2 -translate-y-1/2 h-1 bg-brand-sand rounded-full"></div>
                    <div
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 h-1 bg-brand-terracotta rounded-full transition-all duration-500"
                      style={{
                        // A picked-up piece reports an index past the last dot
                        // (see getStageIndex) — the fill still stops at the
                        // last dot rather than overshooting it.
                        width: `${(Math.min(currentStageIdx, STAGES.length - 1) / (STAGES.length - 1)) * 95}%`
                      }}
                    ></div>

                    {STAGES.map((stage, idx) => {
                      const isCompleted = idx < currentStageIdx;
                      const isActive = idx === currentStageIdx;

                      return (
                        <div key={stage} className="relative z-10 flex flex-col items-center">
                          <div 
                            className={`h-5.5 w-5.5 rounded-full border flex items-center justify-center transition-all ${
                              isCompleted 
                                ? 'bg-brand-terracotta border-brand-terracotta text-brand-cream text-[10px] font-semibold' 
                                : isActive 
                                  ? 'bg-brand-cream border-2 border-brand-terracotta text-brand-terracotta font-semibold' 
                                  : 'bg-brand-sand border-brand-clay text-brand-charcoal/30 text-[10px]'
                            }`}
                          >
                            {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Always one row, matching the dots row above it — a
                      responsive column count would fall out of alignment
                      with the dots, which never wrap. */}
                  <div
                    className="grid gap-x-1 gap-y-2 text-[9px] font-semibold text-center leading-tight"
                    style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(0, 1fr))` }}
                  >
                    {STAGES.map((stage, idx) => {
                      const isActive = idx === currentStageIdx;
                      const isCompleted = idx < currentStageIdx;
                      return (
                        <span 
                          key={stage}
                          className={
                            isActive 
                              ? 'text-brand-terracotta font-semibold uppercase scale-105 block' 
                              : isCompleted 
                                ? 'text-brand-ink block' 
                                : 'text-brand-charcoal/35 block'
                          }
                        >
                          {stage}
                        </span>
                      );
                    })}
                  </div>
                </div>

              </div>
              </ScrollReveal>
            );
          })}
        </div>
      )}

    </div>
  );
};
