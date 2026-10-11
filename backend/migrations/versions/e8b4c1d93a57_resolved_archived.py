"""resolved + archived: вопрос решён, архив разделов

Revision ID: e8b4c1d93a57
Revises: d5a1f3b82c44
Create Date: 2026-10-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e8b4c1d93a57'
down_revision: Union[str, None] = 'd5a1f3b82c44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('threads', sa.Column('is_resolved', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('threads', sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('threads', 'is_archived')
    op.drop_column('threads', 'is_resolved')
