"""f7b8c9d0e1f2_add_user_theme.py"""
from alembic import op
import sqlalchemy as sa

revision = 'f7b8c9d0e1f2'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('theme', sa.String(10), nullable=True, server_default='system'))
    op.execute("UPDATE users SET theme = 'system' WHERE theme IS NULL")
    op.alter_column('users', 'theme', nullable=False, server_default='system')


def downgrade():
    op.drop_column('users', 'theme')