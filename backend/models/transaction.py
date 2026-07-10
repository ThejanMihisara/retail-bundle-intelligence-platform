from datetime import datetime
from sqlalchemy import DateTime, Integer, Float, String
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class SalesTransaction(Base):
    __tablename__ = "sales_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    invoice_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    sale_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    product_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    quantity_sold: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_price: Mapped[float] = mapped_column(Float, nullable=False)
    retail_price: Mapped[float] = mapped_column(Float, nullable=False)
    total_revenue: Mapped[float] = mapped_column(Float, nullable=False)
    profit: Mapped[float] = mapped_column(Float, nullable=False)
