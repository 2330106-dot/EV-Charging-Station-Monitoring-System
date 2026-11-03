const Reservation = require("../models/Reservation");
const Station = require("../models/Station");

const CHECK_IN_GRACE_PERIOD_MS = 5 * 60 * 1000;
const IMMEDIATE_RESERVATION_DURATION_MS = 15 * 60 * 1000;

const ACTIVE_STATUSES = ["WAITING", "RESERVED", "CHECKED_IN", "CHARGING"];

const SLOT_FIELDS = {
  1: "slot1Occupied",
  2: "slot2Occupied",
  3: "slot3Occupied",
  4: "slot4Occupied",
};

// Get the physical station.
const getPhysicalStation = async () => {
  return Station.findOne();
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
  return Reservation.findById(reservationId)
    .populate("user", "name email phone")
    .populate("vehicle", "vehicleNumber vehicleModel batteryCapacity");
};

// Safely convert a date to milliseconds.
const toMillis = (value) => {
  if (!value) return null;

  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : null;
};

// Calculate the immediate reservation's charging-start deadline.
const getImmediateReservationDeadline = (reservation) => {
  const reservedAt = toMillis(reservation.reservedAt);

  if (reservedAt === null) return null;

  return reservedAt + IMMEDIATE_RESERVATION_DURATION_MS;
};

// Determine whether two intervals overlap.
// Intervals use [start, end), so adjacent intervals do not overlap.
const intervalsOverlap = (startA, endA, startB, endB) => {
  const aStart = toMillis(startA);
  const aEnd = toMillis(endA);
  const bStart = toMillis(startB);
  const bEnd = toMillis(endB);

  if (aStart === null || aEnd === null || bStart === null || bEnd === null) {
    return false;
  }

  return aStart < bEnd && bStart < aEnd;
};

// Get the effective conflict window for an active reservation.
//
// CHARGING always blocks the slot until charging is completed.
// Scheduled reservations use their scheduled interval.
// An immediate RESERVED booking expires after its 5-minute
// check-in period if the user has not checked in.
// An immediate CHECKED_IN booking can remain active until its
// 15-minute charging-start deadline.
const getReservationWindow = (reservation) => {
  if (reservation.status === "WAITING") {
    return null;
  }

  // Once charging starts, the slot remains occupied until completion.
  if (reservation.status === "CHARGING") {
    return {
      start: reservation.chargingStartTime || reservation.reservedAt,
      end: null,
      openEnded: true,
    };
  }

  // Scheduled reservations reserve their specified time interval.
  if (reservation.isScheduled) {
    const start = toMillis(reservation.scheduledStartTime);
    const end = toMillis(reservation.scheduledEndTime);

    if (start === null || end === null || end <= start) {
      // An invalid active scheduled reservation should block
      // conservatively rather than silently allowing a conflict.
      return {
        start: reservation.reservedAt || reservation.createdAt,
        end: null,
        openEnded: true,
      };
    }

    return {
      start,
      end,
      openEnded: false,
    };
  }

  const reservedAt = toMillis(reservation.reservedAt);

  if (reservedAt === null) {
    // An active immediate reservation with no timestamp is ambiguous.
    // Do not silently treat it as free.
    return {
      start: reservation.createdAt,
      end: null,
      openEnded: true,
    };
  }

  if (reservation.status === "RESERVED") {
    return {
      start: reservedAt,
      end: reservedAt + CHECK_IN_GRACE_PERIOD_MS,
      openEnded: false,
    };
  }

  if (reservation.status === "CHECKED_IN") {
    return {
      start: reservedAt,
      end: getImmediateReservationDeadline(reservation),
      openEnded: false,
    };
  }

  return null;
};

// Check whether an existing reservation conflicts with a requested
// interval on the same station and slot.
const reservationConflictsWithWindow = (
  reservation,
  requestedStart,
  requestedEnd,
) => {
  const window = getReservationWindow(reservation);

  if (!window) return false;

  const start = toMillis(requestedStart);
  const end = toMillis(requestedEnd);

  if (start === null || end === null || end <= start) {
    return true;
  }

  // An active charging session has no known end until completion.
  if (window.openEnded || window.end === null) {
    return true;
  }

  return intervalsOverlap(start, end, window.start, window.end);
};

// Find an active reservation that conflicts with a requested interval.
const findReservationConflict = async ({
  stationId,
  slotNumber,
  requestedStart,
  requestedEnd,
}) => {
  const candidates = await Reservation.find({
    stationId,
    slotNumber,
    status: { $in: ACTIVE_STATUSES },
  });

  for (const existing of candidates) {
    if (
      reservationConflictsWithWindow(existing, requestedStart, requestedEnd)
    ) {
      return existing;
    }
  }

  return null;
};

// Check whether a requested scheduled interval conflicts with
// another booking for the same station and slot.
const findScheduleConflict = async ({
  stationId,
  slotNumber,
  scheduledStartTime,
  scheduledEndTime,
}) => {
  return findReservationConflict({
    stationId,
    slotNumber,
    requestedStart: scheduledStartTime,
    requestedEnd: scheduledEndTime,
  });
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

    const now = new Date();

    // Immediate bookings require a physically vacant slot.
    if (!isScheduled && isPhysicalSlotOccupied(station, selectedSlot)) {
      return res.status(409).json({
        success: false,
        message: "This physical charging slot is currently occupied",
      });
    }

    if (isScheduled) {
      // Check the full requested scheduled interval.
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
      // An immediate reservation may need the slot for up to
      // 15 minutes. Reject it if that window overlaps a schedule.
      const requestedEnd = new Date(
        now.getTime() + IMMEDIATE_RESERVATION_DURATION_MS,
      );

      const conflict = await findReservationConflict({
        stationId,
        slotNumber: selectedSlot,
        requestedStart: now,
        requestedEnd,
      });

      if (conflict) {
        return res.status(409).json({
          success: false,
          message:
            "This slot is already reserved or conflicts with another booking",
          conflictingReservationId: conflict._id,
        });
      }
    }

    const reservation = await Reservation.create({
      user: req.user.userId,
      vehicle: vehicleId,
      stationId,
      slotNumber: selectedSlot,
      status: "RESERVED",

      // Scheduled bookings activate at their start time.
      reservedAt: isScheduled ? null : now,

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
        now.getTime() + CHECK_IN_GRACE_PERIOD_MS,
      );

      response.chargingStartDeadline = new Date(
        now.getTime() + IMMEDIATE_RESERVATION_DURATION_MS,
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

    const promotionTime = new Date();

    // A promoted user receives an immediate reservation.
    // Check the complete 15-minute start window before assigning it.
    const promotionDeadline = new Date(
      promotionTime.getTime() + IMMEDIATE_RESERVATION_DURATION_MS,
    );

    const conflict = await findReservationConflict({
      stationId,
      slotNumber,
      requestedStart: promotionTime,
      requestedEnd: promotionDeadline,
    });

    if (conflict) {
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

  // Never expire an active charging session through this helper.
  if (reservation.status === "CHARGING") {
    return;
  }

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
      const currentTime = new Date();

      const reservation = await Reservation.findOne({
        _id: candidate._id,
        isScheduled: true,
        status: "RESERVED",
        reservedAt: null,
        scheduledStartTime: { $lte: currentTime },
        scheduledEndTime: { $gt: currentTime },
      });

      if (!reservation) continue;

      reservation.reservedAt = new Date(reservation.scheduledStartTime);

      await reservation.save();

      console.log(
        `Scheduled reservation ${reservation._id} is now active. The 5-minute check-in period has started.`,
      );
    }
  } catch (error) {
    console.error("Scheduled reservation activation error:", error);
  }
};

// EXPIRE RESERVATIONS THAT MISSED THEIR DEADLINES
const expireUnclaimedReservations = async () => {
  try {
    const now = Date.now();

    // 1. Expire immediate reservations that were never checked in.
    const missedImmediateCheckIns = await Reservation.find({
      isScheduled: { $ne: true },
      status: "RESERVED",
      reservedAt: {
        $lte: new Date(now - CHECK_IN_GRACE_PERIOD_MS),
        $ne: null,
      },
    }).sort({
      reservedAt: 1,
    });

    for (const candidate of missedImmediateCheckIns) {
      const reservation = await Reservation.findOne({
        _id: candidate._id,
        isScheduled: { $ne: true },
        status: "RESERVED",
        reservedAt: {
          $lte: new Date(Date.now() - CHECK_IN_GRACE_PERIOD_MS),
          $ne: null,
        },
      });

      if (!reservation) continue;

      await expireReservation(reservation);
    }

    // 2. Expire immediate reservations that checked in but did not
    // start charging within 15 minutes of the original reservation.
    const immediateChargingStartDeadline = new Date(
      Date.now() - IMMEDIATE_RESERVATION_DURATION_MS,
    );

    const missedImmediateChargingStarts = await Reservation.find({
      isScheduled: { $ne: true },
      status: "CHECKED_IN",
      reservedAt: {
        $lte: immediateChargingStartDeadline,
        $ne: null,
      },
    }).sort({
      reservedAt: 1,
    });

    for (const candidate of missedImmediateChargingStarts) {
      const reservation = await Reservation.findOne({
        _id: candidate._id,
        isScheduled: { $ne: true },
        status: "CHECKED_IN",
        reservedAt: {
          $lte: new Date(Date.now() - IMMEDIATE_RESERVATION_DURATION_MS),
          $ne: null,
        },
      });

      if (!reservation) continue;

      await expireReservation(reservation);

      console.log(
        `Immediate reservation ${reservation._id} expired because charging did not start within 15 minutes.`,
      );
    }

    // 3. Expire scheduled reservations whose entire booking window
    // passed without activation.
    const missedSchedules = await Reservation.find({
      isScheduled: true,
      status: "RESERVED",
      reservedAt: null,
      scheduledEndTime: { $lte: new Date() },
    });

    for (const reservation of missedSchedules) {
      await expireReservation(reservation);

      console.log(
        `Scheduled reservation ${reservation._id} expired because its scheduled window ended.`,
      );
    }

    // 4. Expire scheduled reservations that checked in but never
    // started charging before the scheduled end.
    const endedCheckedInReservations = await Reservation.find({
      isScheduled: true,
      status: "CHECKED_IN",
      scheduledEndTime: { $lte: new Date() },
    });

    for (const candidate of endedCheckedInReservations) {
      const reservation = await Reservation.findOne({
        _id: candidate._id,
        isScheduled: true,
        status: "CHECKED_IN",
        scheduledEndTime: { $lte: new Date() },
      });

      if (!reservation) continue;

      await expireReservation(reservation);

      console.log(
        `Scheduled reservation ${reservation._id} expired because its scheduled window ended before charging started.`,
      );
    }

    // Charging sessions are deliberately excluded from expiry.
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

    const now = Date.now();

    // Scheduled reservations cannot be checked in before their start.
    if (
      reservation.isScheduled &&
      reservation.scheduledStartTime &&
      now < new Date(reservation.scheduledStartTime).getTime()
    ) {
      return res.status(400).json({
        success: false,
        message: "Your scheduled reservation has not started yet",
        scheduledStartTime: reservation.scheduledStartTime,
      });
    }

    // Scheduled check-in must happen before the scheduled end.
    if (
      reservation.isScheduled &&
      reservation.scheduledEndTime &&
      now >= new Date(reservation.scheduledEndTime).getTime()
    ) {
      await expireReservation(reservation);

      return res.status(400).json({
        success: false,
        message: "The scheduled charging window has ended",
        status: "EXPIRED",
      });
    }

    // Activate a due scheduled reservation if the background checker
    // has not run yet.
    if (
      reservation.isScheduled &&
      reservation.scheduledStartTime &&
      !reservation.reservedAt
    ) {
      reservation.reservedAt = new Date(reservation.scheduledStartTime);

      await reservation.save();
    }

    const reservedAt = toMillis(reservation.reservedAt);

    if (reservedAt === null || now >= reservedAt + CHECK_IN_GRACE_PERIOD_MS) {
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

    const now = Date.now();

    // Immediate reservations must start charging within 15 minutes
    // of the original reservation creation time.
    if (!reservation.isScheduled) {
      const chargingStartDeadline =
        getImmediateReservationDeadline(reservation);

      if (chargingStartDeadline === null || now >= chargingStartDeadline) {
        await expireReservation(reservation);

        return res.status(400).json({
          success: false,
          message:
            "The 15-minute charging-start deadline has expired. Please make a new reservation or join the queue.",
          status: "EXPIRED",
        });
      }
    }

    // Scheduled charging must begin before its scheduled end.
    if (
      reservation.isScheduled &&
      reservation.scheduledEndTime &&
      now >= new Date(reservation.scheduledEndTime).getTime()
    ) {
      await expireReservation(reservation);

      return res.status(400).json({
        success: false,
        message: "The scheduled charging window has ended",
        status: "EXPIRED",
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
