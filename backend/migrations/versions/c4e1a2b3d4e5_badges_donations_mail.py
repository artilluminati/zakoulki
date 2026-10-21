"""badges + donations + recommendations + password reset + email prefs"""
from alembic import op
import sqlalchemy as sa


revision = 'c4e1a2b3d4e5'
down_revision = 'a3b4c5d6e7f8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('email_notifications', sa.Boolean(), nullable=True, server_default=sa.true()))
    op.execute("UPDATE users SET email_notifications = true WHERE email_notifications IS NULL")
    op.alter_column('users', 'email_notifications', nullable=False, server_default=sa.true())

    op.create_table(
        'user_badges',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('kind', sa.String(30), nullable=False, index=True),
        sa.Column('label', sa.String(80), nullable=True),
        sa.Column('meta', sa.JSON(), nullable=True),
        sa.Column('granted_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('user_id', 'kind', name='uq_user_badges_user_kind'),
    )
    # переносим старый одиночный бейдж в новую таблицу
    op.execute("""
        INSERT INTO user_badges (user_id, kind, label, meta, created_at)
        SELECT id, 'official', 'Официальная организация', '{}'::json, now()
        FROM users WHERE badge = 'official'
    """)

    op.create_table(
        'donations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(8), nullable=False, server_default='RUB'),
        sa.Column('purpose', sa.String(30), nullable=False, server_default='project', index=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('donor_name', sa.String(120), nullable=True),
        sa.Column('donor_email', sa.String(255), nullable=True),
        sa.Column('provider', sa.String(30), nullable=False, server_default='yookassa'),
        sa.Column('provider_payment_id', sa.String(100), nullable=True, unique=True, index=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending', index=True),
        sa.Column('receipt_url', sa.String(255), nullable=True),
        sa.Column('badge_granted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('recommendation_payload', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        'recommendations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('contact', sa.String(150), nullable=False),
        sa.Column('url', sa.String(255), nullable=True),
        sa.Column('topic', sa.String(30), nullable=False, server_default='other', index=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending', index=True),
        sa.Column('donation_id', sa.Integer(), sa.ForeignKey('donations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    )

    # ссылка с доната на рекомендацию — после создания обеих таблиц
    with op.batch_alter_table('donations') as batch:
        batch.add_column(sa.Column('recommendation_id', sa.Integer(), nullable=True))
        batch.create_foreign_key('fk_donations_recommendation', 'recommendations', ['recommendation_id'], ['id'], ondelete='SET NULL')

    op.create_table(
        'password_reset_tokens',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('token', sa.String(100), nullable=False, unique=True, index=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    op.drop_table('password_reset_tokens')
    with op.batch_alter_table('donations') as batch:
        batch.drop_constraint('fk_donations_recommendation', type_='foreignkey')
        batch.drop_column('recommendation_id')
    op.drop_table('recommendations')
    op.drop_table('donations')
    op.drop_table('user_badges')
    op.drop_column('users', 'email_notifications')
