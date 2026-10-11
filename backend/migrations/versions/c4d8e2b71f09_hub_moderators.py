"""hub moderators: модераторы разделов (несколько человек на раздел)

Revision ID: c4d8e2b71f09
Revises: b7e2f9a41c08
Create Date: 2026-10-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4d8e2b71f09'
down_revision: Union[str, None] = 'b7e2f9a41c08'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'hub_moderators',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('hub_id', sa.Integer(), sa.ForeignKey('threads.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('hub_moderators')
