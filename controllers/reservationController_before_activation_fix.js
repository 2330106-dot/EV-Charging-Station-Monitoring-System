const Reservation = require("../models/Reservation");
const Station = require("../models/Station");

const CHECK_IN_GRACE_PERIOD_MS = 5 * 60 * 1000;

const ACTIVE_STATUSES = ["WAITING", "RESERVED", "CHECKED_IN", "CHARGING"];

const SLOT_FIELDS = {
  1: "slot1Occupied",
  2: "slot2Occupied",
  3: "slot3Occupied",
  4: "slot4Occupied",
};

// Get the physical station.
const getPhysicalStation = async () => {
  return await Station.findOne();
};

// Check whether the physical slot is occupied.
const isPhysicalSlotOccupied = (station, slotNumber) => {
  if (!station) return true;

  const field = SLOT_FIELDS[slotNumber];

  if (!field) return true;

  return station[field] === true;
};

// Populate a reservation consistently for API responses.
const populateReservation = async (reservationId) => {
  return await Reservation.findById(reservationId)
    .populate("user", "name email phone")
    .populate("vehicle", "vehicleNumber vehicleModel batteryCapacity");
};

// Determine whether two time intervals overlap.
// Intervals are treated as [start, end).
const intervalsOverlap = (startA, endA, startB, endB) => {
  return (
    new Date(startA).getTime() < new Date(endB).getTime() &&
    new Date(startB).getTime() < new Date(endA).getTime()
  );
};

// Check whether a requested scheduled interval conflicts with
// another booking for the same station and slot.
const findScheduleConflict = async ({
  stationId,
  slotNumber,
  scheduledStartTime,
  scheduledEndTime,
}) => {
  const candidates = await Reservation.find({
    stationId,
    slotNumber,
    status: { $in: ACTIVE_STATUSES },
  });

  const requestedStart = new Date(scheduledStartTime);
  const requestedEnd = new Date(scheduledEndTime);

  for (const existing of candidates) {
    // A queue entry has no allocated slot yet.
    if (existing.status === "WAITING") continue;

    // A scheduled reservation has a defined booking interval.
    if (
      existing.isScheduled &&
      existing.scheduledStartTime &&
      existing.scheduledEndTime
    ) {
      if (
        intervalsOverlap(
          requestedStart,
          requestedEnd,
          existing.scheduledStartTime,
          existing.scheduledEndTime,
        )
      ) {
        return existing;
      }

      continue;
    }

    // An immediate reservation has no known end time until
    // charging is completed. Conservatively treat it as occupying
    // the slot when checking a new schedule.
    return existing;
  }

  return null;
};

// CREATE AN IMMEDIATE OR SCHEDULED RESERVATION
const createReservation = async (req, res) => {
  try {
    const {
      vehicleId,
      stationId,
      slotNumber,
      scheduledStartTime,
      scheduledEndTime,
    } = req.body;

    if (
      !vehicleId ||
      !stationId ||
      !Number.isInteger(Number(slotNumber)) ||
      Number(slotNumber) < 1 ||
      Number(slotNumber) > 4
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid vehicle, station and slot are required",
      });
    }

    const selectedSlot = Number(slotNumber);
    const isScheduled =
      scheduledStartTime !== undefined &&
      scheduledStartTime !== null &&
      scheduledStartTime !== "";

    let startTime = null;
    let endTime = null;

    if (isScheduled) {
      startTime = new Date(scheduledStartTime);
      endTime = new Date(scheduledEndTime);

      if (
        !scheduledEndTime ||
        !Number.isFinite(startTime.getTime()) ||
        !Number.isFinite(endTime.getTime())
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid scheduled start and end times are required",
        });
      }

      const now = Date.now();

      if (startTime.getTime() <= now) {
        return res.status(400).json({
          success: false,
          message: "Scheduled start time must be in the future",
        });
      }

      if (endTime.getTime() <= startTime.getTime()) {
        return res.status(400).json({
          success: false,
          message: "Scheduled end time must be after the start time",
        });
      }
    }

    const station = await Station.findById(stationId);

    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Charging station not found",
      });
    }

    // Immediate bookings require the physical slot to be vacant now.
    // Scheduled bookings are validated against their future time
    // interval instead.
    if (!isScheduled && isPhysicalSlotOccupied(station, selectedSlot)) {
      return res.status(409).json({
        success: false,
        message: "This physical charging slot is currently occupied",
      });
    }

    // Prevent overlapping schedules on the same station and slot.
    if (isScheduled) {
      const conflict = await findScheduleConflict({
        stationId,
        slotNumber: selectedSlot,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
      });

      if (conflict) {
        return res.status(409).json({
          success: false,
          message:
            "This slot already has a reservation that conflicts with the selected time",
          conflictingReservationId: conflict._id,
        });
      }
    } else {
      // Preserve the existing immediate-reservation rule.
      const existingReservation = await Reservation.findOne({
        stationId,
        slotNumber: selectedSlot,
        status: { $in: ACTIVE_STATUSES },
      });

      if (existingReservation) {
        return res.status(409).json({
          success: false,
          message: "This slot is already reserved",
        });
      }
    }

    // A scheduled reservation is stored as RESERVED, but reservedAt
    // remains null until its scheduled start time. This prevents the
    // normal 5-minute expiry checker from expiring it prematurely.
    const reservation = await Reservation.create({
      user: req.user.userId,
      vehicle: vehicleId,
      stationId,
      slotNumber: selectedSlot,
      status: "RESERVED",

      reservedAt: isScheduled ? null : new Date(),

      isScheduled,
      scheduledStartTime: isScheduled ? startTime : null,
      scheduledEndTime: isScheduled ? endTime : null,

      queuePosition: null,
      queuedAt: null,
      queueJoinedAt: null,
      queueWaitMinutes: null,
    });

    const populatedReservation = await populateReservation(reservation._id);

    const response = {
      success: true,
      reservation: populatedReservation,
    };

    if (isScheduled) {
      response.message = "Scheduled charging reservation created successfully";
      response.checkInOpensAt = startTime;
      response.checkInDeadline = new Date(
        startTime.getTime() + CHECK_IN_GRACE_PERIOD_MS,
      );
    } else {
      response.message =
        "Slot reserved successfully. Check in within 5 minutes.";
      response.checkInDeadline = new Date(
        reservation.reservedAt.getTime() + CHECK_IN_GRACE_PERIOD_MS,
      );
    }

    return res.status(201).json(response);
  } catch (error) {
    console.error("Create reservation error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while creating reservation",
    });
  }
};

// JOIN CHARGING QUEUE
const joinQueue = async (req, res) => {
  try {
    const { vehicleId, stationId } = req.body;

    if (!vehicleId || !stationId) {
      return res.status(400).json({
        success: false,
        message: "Vehicle and station are required",
      });
    }

    const existingUserReservation = await Reservation.findOne({
      user: req.user.userId,
      stationId,
      status: { $in: ACTIVE_STATUSES },
    });

    if (existingUserReservation) {
      return res.status(409).json({
        success: false,
        message:
          "You already have an active reservation or queue entry for this station",
      });
    }

    const station = await Station.findById(stationId);

    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Charging station not found",
      });
    }

    if (station.availableSlots > 0) {
      return res.status(400).json({
        success: false,
        message:
          "A physical charging slot is currently available. Please reserve an available slot.",
        availableSlots: station.availableSlots,
      });
    }

    const lastWaitingReservation = await Reservation.findOne({
      stationId,
      status: "WAITING",
    }).sort({
      queuePosition: -1,
    });

    const nextQueuePosition = lastWaitingReservation
      ? lastWaitingReservation.queuePosition + 1
      : 1;

    const queueEntryTime = new Date();

    const reservation = await Reservation.create({
      user: req.user.userId,
      vehicle: vehicleId,
      stationId,
      slotNumber: null,
      status: "WAITING",

      isScheduled: false,
      scheduledStartTime: null,
      scheduledEndTime: null,

      queuePosition: nextQueuePosition,
      queuedAt: queueEntryTime,
      queueJoinedAt: queueEntryTime,
      queueWaitMinutes: null,
      reservedAt: null,
    });

    const populatedReservation = await populateReservation(reservation._id);

    return res.status(201).json({
      success: true,
      message: "Joined charging queue successfully",
      queuePosition: nextQueuePosition,
      reservation: populatedReservation,
    });
  } catch (error) {
    console.error("Join queue error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while joining the queue",
    });
  }
};

// PROMOTE THE NEXT QUEUED USER
const promoteNextQueuedUser = async (stationId, slotNumber) => {
  try {
    const station = await Station.findById(stationId);

    if (!station || isPhysicalSlotOccupied(station, slotNumber)) {
      return null;
    }

    const now = new Date();

    // Do not assign a slot already used by an active reservation.
    const existingReservation = await Reservation.findOne({
      stationId,
      slotNumber,
      status: { $in: ["RESERVED", "CHECKED_IN", "CHARGING"] },
      $or: [
        { isScheduled: { $ne: true } },
        { scheduledStartTime: null },
        { scheduledStartTime: { $lte: now } },
      ],
    });

    if (existingReservation) {
      return null;
    }

    // A future scheduled reservation must retain its slot, even
    // though it has not reached its activation time yet.
    const futureScheduledReservation = await Reservation.findOne({
      stationId,
      slotNumber,
      isScheduled: true,
      status: "RESERVED",
      scheduledStartTime: { $gt: now },
      scheduledEndTime: { $gt: now },
    }).sort({ scheduledStartTime: 1 });

    if (futureScheduledReservation) {
      return null;
    }

    const nextReservation = await Reservation.findOne({
      stationId,
      status: "WAITING",
    }).sort({
      queuePosition: 1,
      queuedAt: 1,
    });

    if (!nextReservation) {
      return null;
    }

    const promotionTime = new Date();
    const queueStartTime =
      nextReservation.queueJoinedAt || nextReservation.queuedAt;

    if (queueStartTime) {
      const elapsedMs =
        promotionTime.getTime() - new Date(queueStartTime).getTime();

      if (Number.isFinite(elapsedMs) && elapsedMs >= 0) {
        nextReservation.queueWaitMinutes =
          Math.round((elapsedMs / 60000) * 100) / 100;
      }
    }

    nextReservation.status = "RESERVED";
    nextReservation.slotNumber = slotNumber;
    nextReservation.queuePosition = null;
    nextReservation.queuedAt = null;
    nextReservation.reservedAt = promotionTime;
    nextReservation.isScheduled = false;
    nextReservation.scheduledStartTime = null;
    nextReservation.scheduledEndTime = null;

    await nextReservation.save();

    console.log(
      `Queue promotion: reservation ${nextReservation._id} assigned to slot ${slotNumber}; actual queue wait: ${
        nextReservation.queueWaitMinutes ?? "unavailable"
      } minutes`,
    );

    return nextReservation;
  } catch (error) {
    console.error("Queue promotion error:", error);
    return null;
  }
};

// EXPIRE A RESERVATION AND PROMOTE THE NEXT USER IF POSSIBLE
const expireReservation = async (reservation) => {
  const slotNumber = reservation.slotNumber;
  const stationId = reservation.stationId;

  reservation.status = "EXPIRED";
  await reservation.save();

  console.log(`Reservation ${reservation._id} expired. Slot: ${slotNumber}`);

  if (slotNumber >= 1 && slotNumber <= 4) {
    await promoteNextQueuedUser(stationId, slotNumber);
  }
};

// ACTIVATE SCHEDULED RESERVATIONS WHEN THEIR START TIME ARRIVES
const activateScheduledReservations = async () => {
  try {
    const now = new Date();

    const dueReservations = await Reservation.find({
      isScheduled: true,
      status: "RESERVED",
      reservedAt: null,
      scheduledStartTime: { $lte: now },
      scheduledEndTime: { $gt: now },
    }).sort({
      scheduledStartTime: 1,
    });

    for (const candidate of dueReservations) {
      // Re-check before updating in case another request changed it.
      const reservation = await Reservation.findOne({
        _id: candidate._id,
        isScheduled: true,
        status: "RESERVED",
        reservedAt: null,
        scheduledStartTime: { $lte: new Date() },
        scheduledEndTime: { $gt: new Date() },
      });

      if (!reservation) continue;

      reservation.reservedAt = new Date();
      await reservation.save();

      console.log(
        `Scheduled reservation ${reservation._id} is now active. The 5-minute check-in period has started.`,
      );
    }
  } catch (error) {
    console.error("Scheduled reservation activation error:", error);
  }
};

// EXPIRE RESERVATIONS THAT MISSED THEIR CHECK-IN WINDOW
const expireUnclaimedReservations = async () => {
  try {
    const deadline = new Date(Date.now() - CHECK_IN_GRACE_PERIOD_MS);

    const expiredReservations = await Reservation.find({
      status: "RESERVED",
      reservedAt: { $lte: deadline, $ne: null },

      // Do not expire a future booking before its activation time.
      $or: [
        { isScheduled: { $ne: true } },
        { scheduledStartTime: { $lte: new Date() } },
      ],
    }).sort({
      reservedAt: 1,
    });

    for (const reservation of expiredReservations) {
      const currentReservation = await Reservation.findOne({
        _id: reservation._id,
        status: "RESERVED",
        reservedAt: { $lte: deadline, $ne: null },
        $or: [
          { isScheduled: { $ne: true } },
          { scheduledStartTime: { $lte: new Date() } },
        ],
      });

      if (!currentReservation) continue;

      await expireReservation(currentReservation);
    }

    // A scheduled reservation whose entire window passed without
    // activation is no longer usable.
    const missedSchedules = await Reservation.find({
      isScheduled: true,
      status: "RESERVED",
      reservedAt: null,
      scheduledEndTime: { $lte: new Date() },
    });

    for (const reservation of missedSchedules) {
      reservation.status = "EXPIRED";
      await reservation.save();

      console.log(
        `Scheduled reservation ${reservation._id} expired because its scheduled window ended.`,
      );
    }
  } catch (error) {
    console.error("Reservation expiry check error:", error);
  }
};

// CHECK IN
const checkInReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findById(id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
      });
    }

    if (reservation.user.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to check in for this reservation",
      });
    }

    if (reservation.status !== "RESERVED") {
      return res.status(400).json({
        success: false,
        message:
          "Reservation cannot be checked in because its current status is " +
          reservation.status,
      });
    }

    // A scheduled reservation cannot be checked in before its start.
    if (
      reservation.isScheduled &&
      reservation.scheduledStartTime &&
      Date.now() < new Date(reservation.scheduledStartTime).getTime()
    ) {
      return res.status(400).json({
        success: false,
        message: "Your scheduled reservation has not started yet",
        scheduledStartTime: reservation.scheduledStartTime,
      });
    }

    const now = Date.now();
    const reservedAt = reservation.reservedAt
      ? new Date(reservation.reservedAt).getTime()
      : null;

    if (
      reservedAt === null ||
      !Number.isFinite(reservedAt) ||
      now >= reservedAt + CHECK_IN_GRACE_PERIOD_MS
    ) {
      await expireReservation(reservation);

      return res.status(400).json({
        success: false,
        message:
          "The 5-minute check-in period has expired. Please make a new reservation or join the queue.",
        status: "EXPIRED",
      });
    }

    reservation.status = "CHECKED_IN";
    reservation.checkInTime = new Date();

    await reservation.save();

    const populatedReservation = await populateReservation(reservation._id);

    return res.json({
      success: true,
      message: "Check-in successful",
      reservation: populatedReservation,
    });
  } catch (error) {
    console.error("Check-in reservation error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while checking in",
    });
  }
};

// START CHARGING
const startChargingReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findById(id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
      });
    }

    if (reservation.user.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to start charging for this reservation",
      });
    }

    if (reservation.status !== "CHECKED_IN") {
      return res.status(400).json({
        success: false,
        message:
          "Charging cannot be started because the current reservation status is " +
          reservation.status,
      });
    }

    if (
      reservation.isScheduled &&
      reservation.scheduledEndTime &&
      Date.now() >= new Date(reservation.scheduledEndTime).getTime()
    ) {
      return res.status(400).json({
        success: false,
        message: "The scheduled charging window has ended",
      });
    }

    reservation.status = "CHARGING";
    reservation.chargingStartTime = new Date();

    await reservation.save();

    const populatedReservation = await populateReservation(reservation._id);

    return res.json({
      success: true,
      message: "Charging started successfully",
      reservation: populatedReservation,
    });
  } catch (error) {
    console.error("Start charging reservation error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while starting charging",
    });
  }
};

// COMPLETE CHARGING
const completeChargingReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findById(id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
      });
    }

    if (reservation.user.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to complete charging for this reservation",
      });
    }

    if (reservation.status !== "CHARGING") {
      return res.status(400).json({
        success: false,
        message:
          "Charging cannot be completed because the current reservation status is " +
          reservation.status,
      });
    }

    const freedSlotNumber = reservation.slotNumber;
    const stationId = reservation.stationId;

    reservation.status = "COMPLETED";
    reservation.chargingEndTime = new Date();

    await reservation.save();

    const promotedReservation = await promoteNextQueuedUser(
      stationId,
      freedSlotNumber,
    );

    const populatedReservation = await populateReservation(reservation._id);

    let populatedPromotedReservation = null;

    if (promotedReservation) {
      populatedPromotedReservation = await populateReservation(
        promotedReservation._id,
      );
    }

    return res.json({
      success: true,
      message: "Charging completed successfully",
      reservation: populatedReservation,
      promotedReservation: populatedPromotedReservation,
    });
  } catch (error) {
    console.error("Complete charging reservation error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while completing charging",
    });
  }
};

// GET MY RESERVATIONS
const getMyReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find({
      user: req.user.userId,
    })
      .populate("vehicle", "vehicleNumber vehicleModel batteryCapacity")
      .sort({
        createdAt: -1,
      });

    return res.json({
      success: true,
      reservations,
    });
  } catch (error) {
    console.error("Get reservations error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching reservations",
    });
  }
};

module.exports = {
  createReservation,
  joinQueue,
  promoteNextQueuedUser,
  activateScheduledReservations,
  expireUnclaimedReservations,
  checkInReservation,
  startChargingReservation,
  completeChargingReservation,
  getMyReservations,
};
