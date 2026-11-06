"""d2e3f4a5b6c7_add_user_name.py — добавляет отображаемое имя пользователя"""
from alembic import op
import sqlalchemy as sa

revision = 'd2e3f4a5b6c7'
down_revision = 'a9c3f1e5b7d2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('name', sa.String(60), nullable=True))


def downgrade():
    op.drop_column('users', 'name')
