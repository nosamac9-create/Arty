-- =============================================================================
-- 0009 — seed a real Table Inventory if one has never been saved
--
-- `capacitySettings.tables` used to exist only as client-side default state
-- in the Settings form — nothing was written to the database until a staff
-- member pressed "Save Capacity Settings" once, which is also the source of
-- the Table Inventory numbers used for live queue seating. Without that save,
-- the queue had no real tables to assign, only the old aggregate estimate.
-- This seeds one real row if the setting is entirely missing; an existing
-- configuration (however it was saved) is left untouched.
-- =============================================================================

insert into public.app_settings (id, value)
values (
  'capacitySettings',
  jsonb_build_object(
    'totalTables', 8,
    'totalSeats', 32,
    'defaultSeatsPerTable', 4,
    'maxGroupSize', 10,
    'oneGroupPerTable', false,
    'tables', jsonb_build_array(
      jsonb_build_object('id', 'table-1', 'number', 1, 'name', 'Table 1', 'seats', 4, 'status', 'Active'),
      jsonb_build_object('id', 'table-2', 'number', 2, 'name', 'Table 2', 'seats', 4, 'status', 'Active'),
      jsonb_build_object('id', 'table-3', 'number', 3, 'name', 'Table 3', 'seats', 4, 'status', 'Active'),
      jsonb_build_object('id', 'table-4', 'number', 4, 'name', 'Table 4', 'seats', 4, 'status', 'Active'),
      jsonb_build_object('id', 'table-5', 'number', 5, 'name', 'Table 5', 'seats', 4, 'status', 'Active'),
      jsonb_build_object('id', 'table-6', 'number', 6, 'name', 'Table 6', 'seats', 4, 'status', 'Active'),
      jsonb_build_object('id', 'table-7', 'number', 7, 'name', 'Table 7', 'seats', 4, 'status', 'Active'),
      jsonb_build_object('id', 'table-8', 'number', 8, 'name', 'Table 8', 'seats', 4, 'status', 'Active')
    )
  )
)
on conflict (id) do nothing;
