-- =============================================================================
-- 0007 — pottery lifecycle standardised to 3 customer-facing stages
--
-- The pipeline had four making-stages (Greenware, Bisque Firing, Glazing,
-- Ready for Collection) before the two end-states. That is now three:
--
--   Created -> First Burn and Colored -> Ready for Pickup
--
-- Bisque Firing and Glazing collapse into the one middle stage. Collected and
-- Broken remain as end-states — operational outcomes, not steps in the
-- customer's progress bar, which is why Collected is switched to
-- NOT visible-to-customer here: it stays the final status a piece can hold,
-- and its history/audit trail is untouched, but it no longer draws as a
-- fourth dot on the 3-stage tracker.
--
-- Safe to re-run.
-- =============================================================================

-- ---------- migrate pieces onto the three making-stages ----------------------
alter table public.pieces drop constraint if exists pieces_status_valid;

update public.pieces
   set status = case status
     when 'Greenware'             then 'Created'
     when 'Drying'                then 'Created'
     when 'Created'               then 'Created'
     when 'In Processing'         then 'First Burn and Colored'
     when 'Firing'                then 'First Burn and Colored'
     when 'Bisque Firing'         then 'First Burn and Colored'
     when 'Glazing'               then 'First Burn and Colored'
     when 'Ready for Collection'  then 'Ready for Pickup'
     else status
   end
 where status in ('Greenware', 'Drying', 'Created', 'In Processing', 'Firing',
                  'Bisque Firing', 'Glazing', 'Ready for Collection');

-- Anything on a name we do not recognise starts again at the front of the
-- pipeline rather than becoming unreadable.
update public.pieces
   set status = 'Created'
 where status not in ('Created', 'First Burn and Colored', 'Ready for Pickup',
                      'Collected', 'Broken');

alter table public.pieces
  add constraint pieces_status_valid check (
    status in ('Created', 'First Burn and Colored', 'Ready for Pickup',
               'Collected', 'Broken')
  );

-- History is a record of what happened. The renamed/merged stages are
-- relabelled the same way 0006 relabelled its own renames, so the customer's
-- timeline reads as one coherent story rather than mixing old and new names.
update public.piece_history
   set status = case status
     when 'Greenware'             then 'Created'
     when 'Drying'                then 'Created'
     when 'Created'               then 'Created'
     when 'In Processing'         then 'First Burn and Colored'
     when 'Firing'                then 'First Burn and Colored'
     when 'Bisque Firing'         then 'First Burn and Colored'
     when 'Glazing'               then 'First Burn and Colored'
     when 'Ready for Collection'  then 'Ready for Pickup'
     else status
   end
 where status in ('Greenware', 'Drying', 'Created', 'In Processing', 'Firing',
                  'Bisque Firing', 'Glazing', 'Ready for Collection');

-- ---------- one clean, ordered set of stages ---------------------------------
-- 'stage-bisque' becomes the merged middle stage; 'stage-glazing' is retired
-- (its pieces already moved above). Collected keeps its name but is no longer
-- customer-visible, so it cannot appear as a fourth progress step.
insert into public.pipeline_stages (id, name, color, "order", visible_to_customer, customer_label, enabled, notify_customer) values
  ('stage-greenware', 'Created',                '#E07A5F', 0, true,  NULL, true, true),
  ('stage-bisque',    'First Burn and Colored',  '#F2CC8F', 1, true,  NULL, true, true),
  ('stage-ready',     'Ready for Pickup',        '#335C67', 2, true,  NULL, true, true),
  ('stage-collected', 'Collected',               '#111111', 3, false, NULL, true, true),
  ('stage-broken',    'Broken',                  '#B91C1C', 4, false, NULL, true, true)
on conflict (id) do update set
  name                = excluded.name,
  color               = excluded.color,
  "order"             = excluded."order",
  visible_to_customer = excluded.visible_to_customer,
  enabled             = true;

-- The retired stage row — its pieces have already been moved onto the merged
-- 'stage-bisque' row above.
delete from public.pipeline_stages where id = 'stage-glazing';
