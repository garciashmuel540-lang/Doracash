-- Older clients can still try to upload the empty state after losing browser storage.
create function doracash.proteger_respaldo() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (jsonb_array_length(old.datos->'periods') > 0 or jsonb_array_length(old.datos->'goals') > 0)
     and coalesce(jsonb_array_length(new.datos->'periods'), 0) = 0
     and coalesce(jsonb_array_length(new.datos->'goals'), 0) = 0 then
    raise exception 'Una copia vacía no puede sustituir un respaldo con registros.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function doracash.proteger_respaldo() from public, anon, authenticated;
create trigger proteger_respaldo before update of datos on doracash.finanzas
for each row execute function doracash.proteger_respaldo();
