# train_models.py
import os
import yfinance as yf
import pandas as pd
import numpy as np
import joblib

from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error

# 1) Configuration: your universe of stocks
SYMBOLS   = ["AAPL","NVDA","TSLA","MSFT","GOOG"]
MODEL_DIR = "models"
os.makedirs(MODEL_DIR, exist_ok=True)

for sym in SYMBOLS:
    print(f"\nTraining model for {sym}…")

    # 2) Fetch & feature-engineer
    df = yf.download(sym, period="2y", interval="1d").dropna()
    df["return_1d"] = df["Close"].pct_change()
    df["ma_5"]      = df["Close"].rolling(5).mean()
    df["vol_5"]     = df["Volume"].rolling(5).mean()
    df["target"]    = df["Close"].shift(-1)
    df = df.dropna()

    # 3) Build X & y
    X = df[["Close","return_1d","ma_5","vol_5"]]
    y = df["target"]

    # 4) Split & train
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, shuffle=False
    )
    model = RandomForestRegressor(n_estimators=200, random_state=42)
    model.fit(X_train, y_train)

    # 5) Validate
    preds = model.predict(X_val)
    rmse  = np.sqrt(mean_squared_error(y_val, preds))
    print(f"  Validation RMSE for {sym}: {rmse:.2f}")

    # 6) Save
    path = os.path.join(MODEL_DIR, f"{sym}.joblib")
    joblib.dump(model, path)
    print(f"  Saved {sym} model to {path}")
