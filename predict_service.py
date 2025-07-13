import os, joblib, yfinance as yf, pandas as pd, traceback
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sklearn.ensemble import RandomForestRegressor

 # ——— PRELOAD ALL MODELS ON STARTUP ———
MODEL_DIR = "models"
MODELS = {}
for fn in os.listdir(MODEL_DIR):
    if fn.endswith(".joblib"):
        sym = fn[:-7].upper()
        MODELS[sym] = joblib.load(os.path.join(MODEL_DIR, fn))


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

MODEL_DIR = "models"
os.makedirs(MODEL_DIR, exist_ok=True)

def featurize(df: pd.DataFrame):
    df["return_1d"] = df["Close"].pct_change()
    df["ma_5"]      = df["Close"].rolling(5).mean()
    df["vol_5"]     = df["Volume"].rolling(5).mean()
    df = df.dropna()
    X = df[["Close","return_1d","ma_5","vol_5"]]
    y = df["Close"].shift(-1).dropna()
    return X.iloc[:-1], y  # align

# predict_service.py

import os
import joblib
import yfinance as yf
import pandas as pd
import traceback

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000"],  # adjust to your front-end origin
    allow_methods=["GET"],
    allow_headers=["*"],
)

MODEL_DIR = "models"
os.makedirs(MODEL_DIR, exist_ok=True)

def train_symbol(sym: str):
    """Fetch 2y history for sym, train RF on it, save to models/{sym}.joblib."""
    df = yf.download(sym, period="2y", interval="1d").dropna()
    df["return_1d"] = df["Close"].pct_change()
    df["ma_5"]      = df["Close"].rolling(5).mean()
    df["vol_5"]     = df["Volume"].rolling(5).mean()
    df.dropna(inplace=True)
    X = df[["Close","return_1d","ma_5","vol_5"]]
    y = df["Close"].shift(-1).dropna()
    X = X.iloc[:-1]  # align
    model = RandomForestRegressor(n_estimators=200, random_state=42)
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, shuffle=False)
    model.fit(X_train, y_train)
    joblib.dump(model, os.path.join(MODEL_DIR, f"{sym}.joblib"))

@app.get("/predict")
@app.get("/predict")
def predict(symbol: str):
    sym = symbol.upper()
    if sym not in MODELS:
        raise HTTPException(
            status_code=404,
            detail=f"No model for {sym}. Available: {', '.join(MODELS.keys())}"
        )
    model = MODELS[sym]

    try:
        # 1) Download recent price data
        raw = yf.download(
            sym,
            period="15d",
            interval="1d",
            auto_adjust=True,
            group_by="ticker"
        )
        # 2) Handle single vs multi-ticker DataFrame
        df = raw[sym] if isinstance(raw.columns, pd.MultiIndex) else raw

        if df.empty:
            raise HTTPException(404, detail=f"No price data for {sym}")

        # 3) Feature engineering
        df["return_1d"] = df["Close"].pct_change()
        df["ma_5"]      = df["Close"].rolling(5).mean()
        df["vol_5"]     = df["Volume"].rolling(5).mean()
        df = df.dropna()

        last = df.iloc[-1]
        feats = [
            float(last["Close"]),
            float(last["return_1d"]),
            float(last["ma_5"]),
            float(last["vol_5"]),
        ]

        # 4) Predict
        pred = model.predict([feats])[0]

        return {
            "symbol": sym,
            "next_day_close": round(float(pred), 2)
        }

    except HTTPException:
        # re-raise 404/503 errors
        raise
    except Exception as e:
        # log and convert to 500
        traceback.print_exc()
        raise HTTPException(500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": list(MODELS.keys())}

