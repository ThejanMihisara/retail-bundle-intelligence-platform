from datetime import datetime, date
from sqlalchemy import DateTime, Date, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class SavedForecast(Base):
    __tablename__ = "saved_forecasts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    forecast_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    predicted_transactions: Mapped[int] = mapped_column(Integer, nullable=False)
    transaction_lower: Mapped[int] = mapped_column(Integer, nullable=False)
    transaction_upper: Mapped[int] = mapped_column(Integer, nullable=False)
    predicted_quantity_sold: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_lower: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_upper: Mapped[int] = mapped_column(Integer, nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
