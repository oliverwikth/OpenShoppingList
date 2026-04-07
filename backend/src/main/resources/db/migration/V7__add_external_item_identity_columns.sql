alter table shopping_list_item
    add column source_canonical_article_id varchar(160),
    add column source_ean varchar(32),
    add column source_sku varchar(120);
