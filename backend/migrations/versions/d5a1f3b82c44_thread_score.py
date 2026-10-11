"""reddit votes: направление лайков + score треда

Revision ID: d5a1f3b82c44
Revises: c4d8e2b71f09
Create Date: 2026-10-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd5a1f3b82c44'
down_revision: Union[str, None] = 'c4d8e2b71f09'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('thread_likes', sa.Column('value', sa.SmallInteger(), nullable=False, server_default='1'))
    op.add_column('threads', sa.Column('score', sa.Integer(), nullable=False, server_default='0'))
    op.execute("UPDATE threads SET score = likes_count")


def downgrade() -> None:
    op.drop_column('threads', 'score')
    op.drop_column('thread_likes', 'value')
