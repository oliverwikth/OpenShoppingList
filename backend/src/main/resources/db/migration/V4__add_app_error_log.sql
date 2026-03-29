create table app_error_log (
    id uuid primary key,
    level varchar(16) not null,
    source varchar(40) not null,
    code varchar(80),
    message text not null,
    path varchar(255),
    http_method varchar(12),
    actor_display_name varchar(60),
    details_json text not null default '{}',
    occurred_at timestamptz not null
);

create index app_error_log_occurred_idx on app_error_log (occurred_at desc);
create index app_error_log_source_idx on app_error_log (source, occurred_at desc);
