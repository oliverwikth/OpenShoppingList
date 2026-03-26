alter table shopping_list_item
    add column if not exists quantity integer not null default 1;
