import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:password@localhost:3306/bundlemind_db",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# Import models here to register them with metadata
from models.user import User
from models.transaction import SalesTransaction
from models.access_request import AccessRequest  # noqa: F401 — registers table


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def initialize_database() -> None:
    try:
        Base.metadata.create_all(bind=engine)
        if engine.dialect.name != "mysql":
            return

        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'manager'"))
            connection.execute(text("UPDATE users SET role = LOWER(role)"))
            connection.execute(text(
                "UPDATE users SET role = 'analyst' "
                "WHERE role NOT IN ('admin','manager','analyst','viewer')"
            ))
            connection.execute(text(
                "ALTER TABLE users "
                "MODIFY COLUMN role ENUM('admin','manager','analyst','viewer') NOT NULL DEFAULT 'manager'"
            ))
            connection.execute(text("ALTER TABLE users MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'invited'"))
            connection.execute(text("UPDATE users SET status = LOWER(status)"))
            connection.execute(text(
                "UPDATE users SET status = 'invited' "
                "WHERE status NOT IN ('active','invited','suspended')"
            ))
            connection.execute(text(
                "ALTER TABLE users "
                "MODIFY COLUMN status ENUM('active','invited','suspended') NOT NULL DEFAULT 'invited'"
            ))
            connection.execute(text(
                "ALTER TABLE access_requests MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending'"
            ))
            connection.execute(text("UPDATE access_requests SET status = LOWER(status)"))
            connection.execute(text(
                "UPDATE access_requests SET status = 'pending' "
                "WHERE status NOT IN ('pending','approved','rejected','invited','active','suspended')"
            ))
            connection.execute(text(
                "ALTER TABLE access_requests "
                "MODIFY COLUMN status ENUM('pending','approved','rejected','invited','active','suspended') "
                "NOT NULL DEFAULT 'pending'"
            ))
            for column_name in ("organization", "department"):
                column_exists = connection.execute(
                    text(
                        "SELECT COUNT(*) FROM information_schema.columns "
                        "WHERE table_schema = DATABASE() "
                        "AND table_name = 'access_requests' "
                        "AND column_name = :column_name"
                    ),
                    {"column_name": column_name},
                ).scalar()
                if column_exists:
                    connection.execute(text(f"ALTER TABLE access_requests DROP COLUMN {column_name}"))

        # Auto-migration: add upload_batch column to sales_transactions if missing
        try:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE sales_transactions ADD COLUMN upload_batch INT NULL"))
                connection.execute(text("CREATE INDEX ix_sales_transactions_upload_batch ON sales_transactions (upload_batch)"))
        except Exception:
            pass

        try:
            with engine.begin() as connection:
                connection.execute(text("UPDATE sales_transactions SET upload_batch = 1 WHERE upload_batch IS NULL"))
        except Exception:
            pass

        # No-op

    except OperationalError as exc:
        raise RuntimeError(
            "Could not connect to MySQL. Update bundlemind-backend/.env with your real "
            "DATABASE_URL, for example: "
            "DATABASE_URL=mysql+pymysql://root:YOUR_MYSQL_PASSWORD@localhost:3306/bundlemind_db"
        ) from exc

