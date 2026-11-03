"""один денежный бейдж: убираем младший donor

Денежная поддержка отмечается единственным бейджем «Спонсор проекта».
"""
from alembic import op


revision = "f7a1c9d2b3e4"
down_revision = "c4e1a2b3d4e5"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("DELETE FROM user_badges WHERE kind = 'donor'")


def downgrade():
    # Младший бейдж больше не выдаётся — восстанавливать нечего.
    pass
