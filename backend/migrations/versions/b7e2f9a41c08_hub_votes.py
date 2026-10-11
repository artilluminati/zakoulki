"""drop important, add hub votes: голосование за уголок вместо важности

Revision ID: b7e2f9a41c08
Revises: 9f3a1c7d2e41
Create Date: 2026-10-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7e2f9a41c08'
down_revision: Union[str, None] = '9f3a1c7d2e41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('important_votes')
    op.drop_column('threads', 'important_pinned')
    op.drop_column('threads', 'important_votes')
    op.drop_column('threads', 'important_requested')
    op.drop_column('threads', 'is_important')
    op.add_column('threads', sa.Column('hub_requested', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('threads', sa.Column('hub_votes', sa.Integer(), nullable=False, server_default='0'))
    op.create_table(
        'hub_votes',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('thread_id', sa.Integer(), sa.ForeignKey('threads.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('hub_votes')
    op.drop_column('threads', 'hub_votes')
    op.drop_column('threads', 'hub_requested')
    op.add_column('threads', sa.Column('is_important', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('threads', sa.Column('important_requested', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('threads', sa.Column('important_votes', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('threads', sa.Column('important_pinned', sa.Boolean(), nullable=False, server_default='false'))
    op.create_table(
        'important_votes',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('thread_id', sa.Integer(), sa.ForeignKey('threads.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
