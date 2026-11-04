"""org applications: администрации и организации просят официальный аккаунт"""
import sqlalchemy as sa
from alembic import op


revision = "a9c3f1e5b7d2"
down_revision = "f7a1c9d2b3e4"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "org_applications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kind", sa.String(30), nullable=False, server_default="organization"),
        sa.Column("org_name", sa.String(150), nullable=False),
        sa.Column("city", sa.String(120), nullable=True),
        sa.Column("address", sa.String(255), nullable=True),
        sa.Column("website", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("contact_name", sa.String(120), nullable=False),
        sa.Column("contact_email", sa.String(255), nullable=False),
        sa.Column("contact_phone", sa.String(40), nullable=True),
        sa.Column("account_mode", sa.String(20), nullable=False, server_default="new"),
        sa.Column("existing_account", sa.String(255), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_org_applications_kind", "org_applications", ["kind"])
    op.create_index("ix_org_applications_contact_email", "org_applications", ["contact_email"])
    op.create_index("ix_org_applications_user_id", "org_applications", ["user_id"])
    op.create_index("ix_org_applications_status", "org_applications", ["status"])


def downgrade():
    op.drop_index("ix_org_applications_status", table_name="org_applications")
    op.drop_index("ix_org_applications_user_id", table_name="org_applications")
    op.drop_index("ix_org_applications_contact_email", table_name="org_applications")
    op.drop_index("ix_org_applications_kind", table_name="org_applications")
    op.drop_table("org_applications")
