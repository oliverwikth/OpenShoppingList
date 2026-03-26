alter table shopping_list_item
    add column if not exists claimed_at timestamptz,
    add column if not exists claimed_by_display_name varchar(60);
