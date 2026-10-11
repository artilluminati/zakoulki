"""unique views: просмотры раз в 24ч на зрителя

Revision ID: a3b4c5d6e7f8
Revises: f1a2b3c4d5e6
Create Date: 2026-10-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'thread_views',
        sa.Column('thread_id', sa.Integer(), sa.ForeignKey('threads.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('viewer', sa.String(length=64), primary_key=True),
        sa.Column('viewed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f('ix_thread_views_viewed_at'), 'thread_views', ['viewed_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_thread_views_viewed_at'), table_name='thread_views')
    op.drop_table('thread_views')
