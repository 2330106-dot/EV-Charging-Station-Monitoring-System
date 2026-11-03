
from fastapi import FastAPI
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestRegressor
import numpy as np

app = FastAPI(
    title="EV Charging ML Service",
    description="Prototype charging-time prediction API",
    version="1.0.0"
)

# Temporary demonstration data.
# This is synthetic data, not your 20 real charging records.
# We will replace this with a properly evaluated training pipeline.
X_TRAIN = np.array([
    [1, 1], [2, 1], [3, 1], [4, 1],
    [1, 2], [2, 2], [3, 2], [4, 2],
    [1, 3], [2, 3], [3, 3], [4, 3],
    [1, 4], [2, 4], [3, 4], [4, 4],
], dtype=float)

# Columns: queue position, number of active charging sessions
Y_TRAIN = np.array([
    8, 15, 22, 29,
    12, 20, 28, 36,
    16, 25, 34, 43,
    20, 30, 40, 50
], dtype=float)

model = RandomForestRegressor(
    n_estimators=100,
    random_state=42
)
model.fit(X_TRAIN, Y_TRAIN)


class WaitRequest(BaseModel):
    queue_position: int = Field(ge=1, le=100)
    active_charging_sessions: int = Field(ge=0, le=4)


@app.get("/")
def home():
    return {
        "message": "EV Charging ML Service is running",
        "model": "RandomForestRegressor",
        "training_data": "synthetic demonstration data"
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
def predict_wait(request: WaitRequest):
    features = [[
        request.queue_position,
        request.active_charging_sessions
    ]]

    predicted_minutes = float(model.predict(features)[0])

    return {
        "estimated_wait_minutes": round(max(0, predicted_minutes), 1),
        "model": "RandomForestRegressor",
        "prototype": True,
        "training_data": "synthetic demonstration data"
    }