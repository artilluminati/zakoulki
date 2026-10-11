"""thread hubs (уголки): is_hub, is_hub_talk, hub_id + backfill важных

Revision ID: 9f3a1c7d2e41
Revises: 743cf8b821da
Create Date: 2026-10-11

Уголок = тред-раздел территории/точки (is_hub, place обязателен).
Вопросы прикрепляются через hub_id; у каждого уголка авто-создаётся
тред общего обсуждения (is_hub_talk, hub_id -> уголок).
Важные треды с местом сразу становятся уголками (+ треды обсуждения).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '9f3a1c7d2e41'
down_revision: Union[str, None] = '743cf8b821da'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('threads', sa.Column('is_hub', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('threads', sa.Column('is_hub_talk', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('threads', sa.Column('hub_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_threads_hub_id', 'threads', 'threads', ['hub_id'], ['id'], ondelete='SET NULL')
    op.create_index(op.f('ix_threads_hub_id'), 'threads', ['hub_id'], unique=False)

    # бэкфилл: важные треды с местом -> уголки + треды общего обсуждения
    conn = op.get_bind()
    hubs = conn.execute(sa.text(
        "SELECT id, author_id, COALESCE(title, '') FROM threads "
        "WHERE is_important AND place_id IS NOT NULL AND COALESCE(is_hub, false) = false"
    )).fetchall()
    for hid, author_id, title in hubs:
        hname = title.strip() or "Уголок"
        conn.execute(sa.text("UPDATE threads SET is_hub = true WHERE id = :i"), {"i": hid})
        conn.execute(sa.text(
            "INSERT INTO threads (author_id, body_md, body_html, is_offtop, place_id, hub_id, "
            "is_hub_talk, views, likes_count, comments_count, important_votes, created_at, updated_at) "
            "SELECT :a, 'Общее обсуждение: ' || :n, '', true, place_id, :h, true, "
            "0, 0, 0, 0, now(), now() FROM threads WHERE id = :h"
        ), {"a": author_id, "n": hname, "h": hid})


def downgrade() -> None:
    op.drop_index(op.f('ix_threads_hub_id'), table_name='threads')
    op.drop_constraint('fk_threads_hub_id', 'threads', type_='foreignkey')
    op.drop_column('threads', 'hub_id')
    op.drop_column('threads', 'is_hub_talk')
    op.drop_column('threads', 'is_hub')
