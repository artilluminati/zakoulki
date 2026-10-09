"""v5 question categories

Revision ID: b2d99a223f42
Revises: 61b184cbaedd
"""
from alembic import op

revision = 'b2d99a223f42'
down_revision = '61b184cbaedd'
branch_labels = None
depends_on = None

NEW = [
    (1, "ЖКХ", "zhkh"),
    (2, "Дороги", "dorogi"),
    (3, "Транспорт", "transport"),
    (4, "Благоустройство", "blago"),
    (5, "Стройка", "stroyka"),
    (6, "Экология", "eco"),
    (7, "Безопасность", "safety"),
    (8, "Другое", "other"),
]

OLD = [
    (1, "Архитектура", "arhitektura"),
    (2, "Стрит-арт", "strit-art"),
    (3, "Заброшенные места", "zabroshennye-mesta"),
    (4, "Дворы", "dvory"),
    (5, "Природа", "priroda"),
    (6, "Памятники", "pamyatniki"),
    (7, "Другое", "drugoe"),
]


def upgrade() -> None:
    for i, name, slug in NEW:
        if i <= 7:
            op.execute(f"UPDATE categories SET name='{name}', slug='{slug}' WHERE id={i}")
        else:
            op.execute(f"INSERT INTO categories (name, slug, created_at) VALUES ('{name}', '{slug}', now())")


def downgrade() -> None:
    for i, name, slug in OLD:
        op.execute(f"UPDATE categories SET name='{name}', slug='{slug}' WHERE id={i}")
    op.execute("DELETE FROM categories WHERE id=8")
