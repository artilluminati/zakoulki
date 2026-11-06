"""e5f6a7b8c9d0_add_approved_to_geo_places.py"""
from alembic import op
import sqlalchemy as sa

revision = 'e5f6a7b8c9d0'
down_revision = 'd2e3f4a5b6c7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('geo_places', sa.Column('approved', sa.Boolean(), nullable=True, server_default=sa.true()))
    op.execute("UPDATE geo_places SET approved = true WHERE approved IS NULL")
    op.alter_column('geo_places', 'approved', nullable=False, server_default=sa.true())


def downgrade():
    op.drop_column('geo_places', 'approved')