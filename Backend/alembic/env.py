from logging.config import fileConfig

from alembic import context
from alembic.ddl.postgresql import PostgresqlImpl
from sqlalchemy import Column
from sqlalchemy import MetaData
from sqlalchemy import PrimaryKeyConstraint
from sqlalchemy import String
from sqlalchemy import Table
from sqlalchemy import pool
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import get_settings
from app.core.database import Base
from app.infrastructure.persistence import models  # noqa: F401
from app.infrastructure.persistence import provider_log_models  # noqa: F401
from app.infrastructure.persistence import risk_profile_models  # noqa: F401
from app.infrastructure.persistence import family_group_models  # noqa: F401
from app.infrastructure.persistence import goal_models  # noqa: F401
from app.infrastructure.persistence import recommendation_models  # noqa: F401

# Alembic 1.18 creates alembic_version.version_num as VARCHAR(32). Several
# revision ids are longer than that. version_table_impl (Alembic 1.14+) is the
# supported hook for the version-table shape used when Alembic creates it.
ALEMBIC_VERSION_TABLE = "alembic_version"
ALEMBIC_VERSION_NUM_LENGTH = 255


class ZyndPostgresqlImpl(PostgresqlImpl):
    __dialect__ = "postgresql"

    def version_table_impl(
        self,
        *,
        version_table: str,
        version_table_schema: str | None,
        version_table_pk: bool,
        **kw: object,
    ) -> Table:
        version_table_col = Column(
            "version_num",
            String(ALEMBIC_VERSION_NUM_LENGTH),
            nullable=False,
        )
        vt = Table(
            version_table,
            MetaData(),
            version_table_col,
            schema=version_table_schema,
        )
        if version_table_pk:
            vt.append_constraint(
                PrimaryKeyConstraint("version_num", name=f"{version_table}_pkc")
            )
        return vt


def _widen_existing_version_num(connection: Connection) -> None:
    """Grow a legacy VARCHAR(32) version_num column without recreating the table.

    version_table_impl applies only when the table is first created. Databases
    that already have alembic_version, including one created as VARCHAR(255),
    keep that table. A shorter column is widened in place so later revision
    ids can be stored.
    """
    row = connection.execute(
        text(
            """
            SELECT character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = :table_name
              AND column_name = 'version_num'
            """
        ),
        {"table_name": ALEMBIC_VERSION_TABLE},
    ).first()
    if row is None or row[0] is None or row[0] >= ALEMBIC_VERSION_NUM_LENGTH:
        return
    connection.execute(
        text(
            f"ALTER TABLE {ALEMBIC_VERSION_TABLE} "
            f"ALTER COLUMN version_num TYPE VARCHAR({ALEMBIC_VERSION_NUM_LENGTH})"
        )
    )


config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.database_url)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        _widen_existing_version_num(connection)
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    import asyncio

    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
