"""comment score: стрелки на ответах

Revision ID: f1a2b3c4d5e6
Revises: e8b4c1d93a57
Create Date: 2026-10-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e8b4c1d93a57'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('thread_comments', sa.Column('score', sa.Integer(), nullable=False, server_default='0'))
    op.create_table(
        'comment_votes',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('comment_id', sa.Integer(), sa.ForeignKey('thread_comments.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('value', sa.SmallInteger(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('comment_votes')
    op.drop_column('thread_comments', 'score')
