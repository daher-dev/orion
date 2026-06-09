"""Request/response shapes for the configurable stock-alert threshold.

A single company-wide integer drives the dashboard low-stock / needs-action
computations. Per-variation overrides live on the variation itself and are not
managed through this endpoint pair.
"""

from pydantic import BaseModel, Field

#: Upper bound kept sane to avoid accidental absurd values.
MAX_LOW_STOCK_THRESHOLD = 1_000_000


class StockSettingsRead(BaseModel):
    low_stock_threshold: int


class StockSettingsUpdate(BaseModel):
    low_stock_threshold: int = Field(ge=0, le=MAX_LOW_STOCK_THRESHOLD)
