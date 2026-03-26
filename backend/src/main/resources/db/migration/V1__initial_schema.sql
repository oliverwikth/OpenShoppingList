create table shopping_list (
    id uuid primary key,
    name varchar(120) not null,
    status varchar(20) not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    archived_at timestamptz,
    last_modified_by_display_name varchar(60) not null
);

create table shopping_list_item (
    id uuid primary key,
    list_id uuid not null references shopping_list(id) on delete cascade,
    item_type varchar(20) not null,
    title varchar(255) not null,
    checked boolean not null,
    checked_at timestamptz,
    checked_by_display_name varchar(60),
    last_modified_by_display_name varchar(60) not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    position integer not null,
    quantity integer not null default 1,
    manual_note text,
    source_provider varchar(40),
    source_article_id varchar(120),
    source_image_url text,
    source_category varchar(120),
    source_price_amount numeric(10, 2),
    source_currency varchar(3),
    source_subtitle varchar(255),
    source_payload_json text not null default '{}'
);

create unique index shopping_list_item_list_position_uk on shopping_list_item (list_id, position);
create index shopping_list_item_list_idx on shopping_list_item (list_id);

create table item_activity_log (
    id uuid primary key,
    list_id uuid not null references shopping_list(id) on delete cascade,
    item_id uuid references shopping_list_item(id) on delete cascade,
    event_type varchar(80) not null,
    actor_display_name varchar(60) not null,
    payload_json text not null default '{}',
    occurred_at timestamptz not null
);

create index item_activity_log_list_idx on item_activity_log (list_id, occurred_at desc);
create index item_activity_log_item_idx on item_activity_log (item_id, occurred_at desc);
