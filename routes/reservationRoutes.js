const express = require("express");

const {
  createReservation,
  joinQueue,
  checkInReservation,
  startChargingReservation,
  completeChargingReservation,
  getMyReservations,
} = require("../controllers/reservationController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/*
=========================================================
CREATE A RESERVATION
=========================================================

POST /api/reservations

Authentication required.

The controller handles both:
1. Immediate reservations
2. Scheduled reservations using scheduledStartTime
   and scheduledEndTime
*/

router.post("/", authMiddleware, createReservation);

/*
=========================================================
JOIN THE CHARGING QUEUE
=========================================================

POST /api/reservations/queue/join

Authentication required.
*/

router.post("/queue/join", authMiddleware, joinQueue);

/*
=========================================================
GET THE LOGGED-IN USER'S RESERVATIONS
=========================================================

GET /api/reservations/my

Authentication required.
*/

router.get("/my", authMiddleware, getMyReservations);

/*
=========================================================
CHECK IN TO A RESERVATION
=========================================================

POST /api/reservations/:id/check-in

Authentication required.

The controller validates the reservation's status
and applicable check-in grace period.
*/

router.post("/:id/check-in", authMiddleware, checkInReservation);

/*
=========================================================
START CHARGING
=========================================================

POST /api/reservations/:id/start-charging

Authentication required.
*/

router.post("/:id/start-charging", authMiddleware, startChargingReservation);

/*
=========================================================
COMPLETE CHARGING
=========================================================

POST /api/reservations/:id/complete-charging

Authentication required.
*/

router.post(
  "/:id/complete-charging",
  authMiddleware,
  completeChargingReservation,
);

module.exports = router;
