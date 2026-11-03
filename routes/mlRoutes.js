const express = require("express");
const Reservation = require("../models/Reservation");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Existing endpoint: accepts queue inputs directly.
router.post("/predict-wait", async (req, res) => {
  try {
    const { queue_position, active_charging_sessions } = req.body;

    if (
      !Number.isInteger(queue_position) ||
      queue_position < 1 ||
      queue_position > 100
    ) {
      return res.status(400).json({
        message: "queue_position must be an integer from 1 to 100.",
      });
    }

    if (
      !Number.isInteger(active_charging_sessions) ||
      active_charging_sessions < 0 ||
      active_charging_sessions > 4
    ) {
      return res.status(400).json({
        message: "active_charging_sessions must be an integer from 0 to 4.",
      });
    }

    const prediction = await getMLPrediction(
      queue_position,
      active_charging_sessions,
    );

    return res.status(200).json({
      ...prediction,
      source: "Python FastAPI ML service",
      experimental: true,
      note: "Uses synthetic demonstration training data; not validated for real-world waiting times.",
    });
  } catch (error) {
    console.error("ML prediction error:", error.message);

    return res.status(error.statusCode || 503).json({
      message:
        error.statusCode === 502
          ? "The ML service returned an error."
          : "ML prediction service is unavailable. Check that the Python service is running.",
    });
  }
});

// New endpoint: predicts waiting time using the logged-in user's actual queue.
router.post("/predict-my-wait", authMiddleware, async (req, res) => {
  try {
    const stationId = req.body.stationId || "STATION_001";
    const userId = req.user.userId;

    const myReservation = await Reservation.findOne({
      user: userId,
      stationId,
      status: "WAITING",
    });

    if (!myReservation) {
      return res.status(404).json({
        message: "You do not have an active queue entry at this station.",
      });
    }

    // Sort waiting reservations in queue order.
    const queue = await Reservation.find({
      stationId,
      status: "WAITING",
    }).sort({
      queuePosition: 1,
      queuedAt: 1,
      createdAt: 1,
    });

    const myIndex = queue.findIndex(
      (reservation) =>
        reservation._id.toString() === myReservation._id.toString(),
    );

    if (myIndex === -1) {
      return res.status(409).json({
        message: "Your queue entry changed. Please try again.",
      });
    }

    const queuePosition = myIndex + 1;

    const activeChargingSessions = await Reservation.countDocuments({
      stationId,
      status: "CHARGING",
    });

    const prediction = await getMLPrediction(
      queuePosition,
      activeChargingSessions,
    );

    return res.status(200).json({
      stationId,
      queuePosition,
      activeChargingSessions,
      estimatedWaitMinutes: prediction.estimated_wait_minutes,
      model: prediction.model,
      source: "Live MongoDB queue + Python FastAPI ML service",
      experimental: true,
      trainingData: "Synthetic demonstration data",
      note: "The model uses synthetic training data. This prediction has not been validated against real-world waiting times.",
    });
  } catch (error) {
    console.error("Personal queue prediction error:", error.message);

    return res.status(error.statusCode || 503).json({
      message:
        error.statusCode === 502
          ? "The ML service returned an error."
          : "Could not calculate the prediction. Check that the ML service is running.",
    });
  }
});

// Shared helper for calling the Python ML service.
async function getMLPrediction(queue_position, active_charging_sessions) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  let response;

  try {
    response = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        queue_position,
        active_charging_sessions,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const error = new Error("Python ML service returned an error.");
    error.statusCode = 502;
    throw error;
  }

  return response.json();
}

module.exports = router;
