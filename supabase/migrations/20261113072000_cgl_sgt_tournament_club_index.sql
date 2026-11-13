create index if not exists cgl_sgt_tournaments_club_dates
  on public.cgl_sgt_tournaments(club_slug, start_date desc, end_date desc);
