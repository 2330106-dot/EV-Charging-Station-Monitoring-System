import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

// ==============================
// API URLS
// ==============================

const stationUrl = "http://localhost:5000/api/stations";
const loginUrl = "http://localhost:5000/api/auth/login";
const profileUrl = "http://localhost:5000/api/auth/profile";
const myVehiclesUrl = "http://localhost:5000/api/vehicles/my";
const reservationsUrl = "http://localhost:5000/api/reservations";
const myReservationsUrl = "http://localhost:5000/api/reservations/my";

// ==============================
// FIX LEAFLET MARKER ICON
// ==============================

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",

  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",

  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// ==============================
// MAP HELPER
// ==============================

function MapUpdater({ latitude, longitude }) {
  const map = useMap();

  useEffect(() => {
    if (typeof latitude === "number" && typeof longitude === "number") {
      map.setView([latitude, longitude], 16);
    }
  }, [latitude, longitude, map]);

  return null;
}

// ==============================
// APP
// ==============================

function App() {
  // ==============================
  // LOGIN ST// CREATE RESERVATION STATE

  // ==============================

  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("token"));

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");
  const [loginMessageIsError, setLoginMessageIsError] = useState(false);

  // ==============================
  // STATION STATE
  // ==============================

  const [station, setStation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  // ==============================
  // USER STATE
  // ==============================

  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(false);

  // ==============================
  // VEHICLE STATE
  // ==============================

  const [vehicles, setVehicles] = useState([]);
  const [vehicleLoading, setVehicleLoading] = useState(false);

  // ==============================
  // RESERVATION STATE
  // ==============================

  const [reservations, setReservations] = useState([]);
  const [reservationLoading, setReservationLoading] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState(null);

  // ==============================
  // CREATE RESERVATION STATE
  // ==============================

  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedSlotNumber, setSelectedSlotNumber] = useState("");
  // SCHEDULED RESERVATION STATE
  const [reservationType, setReservationType] = useState("immediate");
  const [scheduledStartTime, setScheduledStartTime] = useState("");
  const [scheduledEndTime, setScheduledEndTime] = useState("");

  const [reservationCreateLoading, setReservationCreateLoading] =
    useState(false);

  const [reservationCreateMessage, setReservationCreateMessage] = useState("");

  const [reservationCreateMessageIsError, setReservationCreateMessageIsError] =
    useState(false);

  // ==============================
  // QUEUE STATE
  // ==============================

  const [queueLoading, setQueueLoading] = useState(false);

  const [queueMessage, setQueueMessage] = useState("");

  const [queueMessageIsError, setQueueMessageIsError] = useState(false);
  // ==============================
  // ML WAITING-TIME PREDICTION
  // ==============================

  const [mlPrediction, setMlPrediction] = useState(null);
  const [mlPredictionLoading, setMlPredictionLoading] = useState(false);
  const [mlPredictionError, setMlPredictionError] = useState("");

  // ==============================
  // RESERVATION ACTION MESSAGE
  // ==============================

  const [reservationActionMessage, setReservationActionMessage] = useState("");

  const [reservationActionMessageIsError, setReservationActionMessageIsError] =
    useState(false);

  // ==============================
  // TOKEN
  // ==============================

  const getToken = () => {
    return localStorage.getItem("token");
  };
  // ==============================
  // FETCH ML WAITING-TIME PREDICTION
  // ==============================

  const fetchMyWaitPrediction = async () => {
    const token = getToken();

    if (!token) {
      setMlPredictionError("Please log in to get a prediction.");
      return;
    }

    try {
      setMlPredictionLoading(true);
      setMlPredictionError("");

      const response = await fetch(
        "http://localhost:5000/api/ml/predict-my-wait",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({
            stationId: station?._id,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to get a waiting-time prediction.",
        );
      }

      setMlPrediction(data);
    } catch (err) {
      console.error("ML prediction error:", err);

      setMlPrediction(null);

      setMlPredictionError(
        err.message || "Unable to connect to the ML prediction service.",
      );
    } finally {
      setMlPredictionLoading(false);
    }
  };

  // ==============================
  // FETCH STATION
  // ==============================

  const fetchStation = async () => {
    try {
      const response = await fetch(stationUrl);

      if (!response.ok) {
        throw new Error("Failed to fetch station data");
      }

      const data = await response.json();

      if (data.success && data.stations?.length > 0) {
        setStation(data.stations[0]);
        setLastUpdated(new Date());
        setError("");
      } else {
        setError("No station data available");
      }
    } catch (err) {
      console.error("Station fetch error:", err);
      setError("Unable to connect to backend station service.");
    } finally {
      setLoading(false);
    }
  };

  // ==============================
  // FETCH USER PROFILE
  // ==============================

  const fetchUserProfile = async () => {
    const token = getToken();

    if (!token) {
      setUser(null);
      return;
    }

    try {
      setUserLoading(true);

      const response = await fetch(profileUrl, {
        method: "GET",

        headers: {
          Authorization: "Bearer " + token,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load profile");
      }

      setUser(data.user);
    } catch (err) {
      console.error("Profile fetch error:", err);

      localStorage.removeItem("token");

      setUser(null);
      setIsLoggedIn(false);
    } finally {
      setUserLoading(false);
    }
  };

  // ==============================
  // FETCH VEHICLES
  // ==============================

  const fetchVehicles = async () => {
    const token = getToken();

    if (!token) {
      setVehicles([]);
      return;
    }

    try {
      setVehicleLoading(true);

      const response = await fetch(myVehiclesUrl, {
        method: "GET",

        headers: {
          Authorization: "Bearer " + token,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load vehicles");
      }

      setVehicles(data.vehicles || []);
    } catch (err) {
      console.error("Vehicle fetch error:", err);
      setVehicles([]);
    } finally {
      setVehicleLoading(false);
    }
  };

  // ==============================
  // FETCH RESERVATIONS
  // ==============================

  const fetchReservations = async () => {
    const token = getToken();

    if (!token) {
      setReservations([]);
      return;
    }

    try {
      setReservationLoading(true);

      const response = await fetch(myReservationsUrl, {
        method: "GET",

        headers: {
          Authorization: "Bearer " + token,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load reservations");
      }

      setReservations(data.reservations || []);
    } catch (err) {
      console.error("Reservation fetch error:", err);
      setReservations([]);
    } finally {
      setReservationLoading(false);
    }
  };

  // ==========================================================
  // CREATE RESERVATION
  // ==========================================================

  const handleCreateReservation = async () => {
    const token = getToken();

    if (!token) {
      setReservationCreateMessage("Please log in again.");
      setReservationCreateMessageIsError(true);
      return;
    }

    if (!station?._id) {
      setReservationCreateMessage(
        "Station information is unavailable. Please refresh the dashboard.",
      );
      setReservationCreateMessageIsError(true);
      return;
    }

    if (!selectedVehicleId) {
      setReservationCreateMessage("Please select a vehicle.");
      setReservationCreateMessageIsError(true);
      return;
    }

    if (!selectedSlotNumber) {
      setReservationCreateMessage("Please select a charging slot.");
      setReservationCreateMessageIsError(true);
      return;
    }

    let reservationBody = {
      vehicleId: selectedVehicleId,
      stationId: station._id,
      slotNumber: Number(selectedSlotNumber),
    };

    if (reservationType === "scheduled") {
      if (!scheduledStartTime || !scheduledEndTime) {
        setReservationCreateMessage(
          "Please select both the scheduled start and end times.",
        );
        setReservationCreateMessageIsError(true);
        return;
      }

      const startDate = new Date(scheduledStartTime);
      const endDate = new Date(scheduledEndTime);

      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        setReservationCreateMessage("Please enter valid scheduled times.");
        setReservationCreateMessageIsError(true);
        return;
      }

      if (startDate <= new Date()) {
        setReservationCreateMessage(
          "The scheduled start time must be in the future.",
        );
        setReservationCreateMessageIsError(true);
        return;
      }

      if (endDate <= startDate) {
        setReservationCreateMessage(
          "The scheduled end time must be after the start time.",
        );
        setReservationCreateMessageIsError(true);
        return;
      }

      reservationBody.scheduledStartTime = startDate.toISOString();
      reservationBody.scheduledEndTime = endDate.toISOString();
    } else if (availableSlotList.length === 0) {
      setReservationCreateMessage(
        "No physical charging slots are currently available.",
      );
      setReservationCreateMessageIsError(true);
      return;
    }

    try {
      setReservationCreateLoading(true);
      setReservationCreateMessage("");
      setReservationCreateMessageIsError(false);

      const response = await fetch(reservationsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify(reservationBody),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to create reservation.");
      }

      setReservationCreateMessage(
        data.message ||
          (reservationType === "scheduled"
            ? "Scheduled reservation created successfully."
            : "Reservation created successfully."),
      );

      setReservationCreateMessageIsError(false);

      setSelectedVehicleId("");
      setSelectedSlotNumber("");
      setScheduledStartTime("");
      setScheduledEndTime("");

      await fetchReservations();
      await fetchStation();
    } catch (err) {
      console.error("Create reservation error:", err);

      setReservationCreateMessageIsError(true);
      setReservationCreateMessage(
        err.message || "Unable to create reservation.",
      );
    } finally {
      setReservationCreateLoading(false);
    }
  };

  // ==========================================================
  // JOIN QUEUE
  // ==========================================================

  const handleJoinQueue = async () => {
    const token = getToken();

    // --------------------------------
    // CHECK LOGIN
    // --------------------------------

    if (!token) {
      setQueueMessage("Please login again.");
      setQueueMessageIsError(true);
      return;
    }
    if (!station?._id) {
      setQueueMessage("Station information is unavailable. Please refresh.");
      setQueueMessageIsError(true);
      return;
    }

    // --------------------------------
    // CHECK VEHICLE
    // --------------------------------

    if (!selectedVehicleId) {
      setQueueMessage("Please select a vehicle before joining the queue.");
      setQueueMessageIsError(true);
      return;
    }

    try {
      setQueueLoading(true);

      setQueueMessage("");
      setQueueMessageIsError(false);

      // --------------------------------
      // SEND QUEUE REQUEST
      // --------------------------------

      const response = await fetch(reservationsUrl + "/queue/join", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },

        body: JSON.stringify({
          vehicleId: selectedVehicleId,

          stationId: station?._id,
        }),
      });

      const data = await response.json();

      // --------------------------------
      // HANDLE BACKEND ERROR
      // --------------------------------

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to join queue.");
      }

      // --------------------------------
      // SUCCESS
      // --------------------------------

      const position =
        data.queuePosition !== undefined && data.queuePosition !== null
          ? data.queuePosition
          : null;

      if (position !== null) {
        setQueueMessage(
          data.message || `You joined the queue at position #${position}.`,
        );
      } else {
        setQueueMessage(
          data.message || "You successfully joined the charging queue.",
        );
      }

      setQueueMessageIsError(false);

      // --------------------------------
      // CLEAR VEHICLE SELECTION
      // --------------------------------

      setSelectedVehicleId("");

      // --------------------------------
      // REFRESH RESERVATIONS
      // --------------------------------

      await fetchReservations();
      await fetchStation();
    } catch (err) {
      console.error("Join queue error:", err);

      setQueueMessageIsError(true);

      setQueueMessage(err.message || "Unable to join queue.");
    } finally {
      setQueueLoading(false);
    }
  };

  // ==============================
  // RESERVATION ACTION
  // ==============================

  const handleReservationAction = async (reservationId, action) => {
    const token = getToken();

    if (!token) {
      setReservationActionMessage("Please login again.");
      setReservationActionMessageIsError(true);
      return;
    }

    try {
      setActionLoadingId(reservationId);

      setReservationActionMessage("");
      setReservationActionMessageIsError(false);

      let endpoint = "";

      if (action === "check-in") {
        endpoint = reservationsUrl + "/" + reservationId + "/check-in";
      } else if (action === "start-charging") {
        endpoint = reservationsUrl + "/" + reservationId + "/start-charging";
      } else if (action === "complete-charging") {
        endpoint = reservationsUrl + "/" + reservationId + "/complete-charging";
      } else {
        throw new Error("Invalid reservation action.");
      }

      const response = await fetch(endpoint, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update reservation.");
      }

      setReservationActionMessage(
        data.message || "Reservation updated successfully.",
      );

      setReservationActionMessageIsError(false);

      await fetchReservations();

      // Refresh station after charging completion
      await fetchStation();
    } catch (err) {
      console.error("Reservation action error:", err);

      setReservationActionMessageIsError(true);

      setReservationActionMessage(
        err.message || "Unable to update reservation.",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // ==============================
  // LOGIN
  // ==============================

  const handleLogin = async (event) => {
    event.preventDefault();

    setLoginMessage("");

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginMessageIsError(true);

      setLoginMessage("Please enter your email and password.");

      return;
    }

    try {
      setLoginLoading(true);
      setLoginMessage("");

      const response = await fetch(loginUrl, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Login failed");
      }

      // ==============================
      // SAVE JWT
      // ==============================

      localStorage.setItem("token", data.token);

      // ==============================
      // UPDATE LOGIN STATE
      // ==============================

      setIsLoggedIn(true);

      setLoginEmail("");
      setLoginPassword("");

      setLoginMessage("");
      setLoginMessageIsError(false);

      // ==============================
      // LOAD USER DATA
      // ==============================

      await fetchUserProfile();
      await fetchVehicles();
      await fetchReservations();
    } catch (err) {
      console.error("Login error:", err);

      setLoginMessageIsError(true);

      setLoginMessage(err.message || "Login failed. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  // ==============================
  // LOGOUT
  // ==============================

  const handleLogout = () => {
    localStorage.removeItem("token");

    setUser(null);
    setVehicles([]);
    setReservations([]);

    setIsLoggedIn(false);

    setLoginMessage("");
    setLoginMessageIsError(false);

    setReservationActionMessage("");

    // Clear reservation creation state
    setSelectedVehicleId("");
    setSelectedSlotNumber("");
    setReservationType("immediate");
    setScheduledStartTime("");
    setScheduledEndTime("");
    setReservationCreateMessage("");
    setReservationCreateMessageIsError(false);

    // Clear queue state
    setQueueMessage("");
    setQueueMessageIsError(false);
  };

  // ==============================
  // INITIAL LOAD
  // ==============================

  useEffect(() => {
    fetchStation();

    if (getToken()) {
      fetchUserProfile();
      fetchVehicles();
      fetchReservations();
    }

    const interval = setInterval(() => {
      fetchStation();

      if (getToken()) {
        fetchReservations();
      }
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // ==============================
  // LOGIN SCREEN
  // ==============================

  if (!isLoggedIn) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-icon">⚡</div>

          <h1>EV Charging Station</h1>

          <p className="login-subtitle">
            Real-Time Charging Station Monitoring System
          </p>

          <form onSubmit={handleLogin}>
            <div className="login-field">
              <label>Email</label>

              <input
                type="email"
                placeholder="Enter your email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
              />
            </div>

            <div className="login-field">
              <label>Password</label>

              <input
                type="password"
                placeholder="Enter your password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
            </div>

            {loginMessage && (
              <div
                className={
                  loginMessageIsError
                    ? "login-message login-error"
                    : "login-message"
                }
              >
                {loginMessage}
              </div>
            )}

            <button
              type="submit"
              className="login-button"
              disabled={loginLoading}
            >
              {loginLoading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==============================
  // LOADING STATION
  // ==============================

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>

        <h2>Loading EV Charging Station...</h2>

        <p>Connecting to backend...</p>
      </div>
    );
  }

  // ==============================
  // STATION DATA
  // ==============================

  const batteryPercentage = station?.batteryPercentage ?? 0;

  const chargingPower = station?.chargingPower ?? 0;

  const availableSlots = station?.availableSlots ?? 0;

  const totalSlots = station?.totalSlots ?? 4;

  const pricePerKwh = station?.pricePerKwh ?? 0;

  const energyConsumed = station?.energyConsumed ?? 0;

  const estimatedCompletionTime = station?.estimatedCompletionTime ?? 0;

  const stationStatus = station?.status || "Available";

  const latitude = station?.location?.latitude ?? 20.3539;

  const longitude = station?.location?.longitude ?? 85.8179;

  // ==============================
  // SLOT DATA
  // ==============================

  const slots = [
    {
      number: 1,
      occupied: station?.slot1Occupied ?? false,
    },

    {
      number: 2,
      occupied: station?.slot2Occupied ?? false,
    },

    {
      number: 3,
      occupied: station?.slot3Occupied ?? false,
    },

    {
      number: 4,
      occupied: station?.slot4Occupied ?? false,
    },
  ];

  // ==============================
  // AVAILABLE SLOT DATA
  // ==============================

  const availableSlotList = slots.filter((slot) => !slot.occupied);

  // ==============================
  // STATION FULL
  // ==============================

  const isStationFull = availableSlots === 0;

  // ==============================
  // FORMAT DATE
  // ==============================

  const formattedLastUpdated = lastUpdated
    ? lastUpdated.toLocaleString()
    : "Not available";

  // ==============================
  // FORMAT RESERVATION DATE
  // ==============================

  const formatReservationDate = (date) => {
    if (!date) {
      return "Not available";
    }

    return new Date(date).toLocaleString();
  };

  // ==============================
  // RESERVATION ACTION BUTTON
  // ==============================

  const renderReservationAction = (reservation) => {
    const reservationId = reservation?._id;

    if (!reservationId) {
      return null;
    }

    const isLoading = actionLoadingId === reservationId;

    // WAITING
    if (reservation.status === "WAITING") {
      return (
        <div
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "8px",
            background: "#fff7ed",
            color: "#c2410c",
            fontWeight: "700",
            textAlign: "center",
            border: "1px solid #fed7aa",
          }}
        >
          ⏳ Waiting for an available charging slot
        </div>
      );
    }

    // RESERVED
    if (reservation.status === "RESERVED") {
      const now = Date.now();

      const scheduledStart = reservation.scheduledStartTime
        ? new Date(reservation.scheduledStartTime).getTime()
        : null;

      const scheduledEnd = reservation.scheduledEndTime
        ? new Date(reservation.scheduledEndTime).getTime()
        : null;

      if (
        reservation.isScheduled &&
        scheduledStart !== null &&
        now < scheduledStart
      ) {
        return (
          <div
            style={{
              width: "100%",
              padding: "12px 16px",
              boxSizing: "border-box",
              borderRadius: "8px",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontWeight: "600",
              textAlign: "center",
              border: "1px solid #bfdbfe",
            }}
          >
            📅 Check-in opens at{" "}
            {formatReservationDate(reservation.scheduledStartTime)}
          </div>
        );
      }

      if (
        reservation.isScheduled &&
        scheduledEnd !== null &&
        now >= scheduledEnd
      ) {
        return (
          <div
            style={{
              padding: "12px",
              textAlign: "center",
              color: "#b91c1c",
              background: "#fef2f2",
              borderRadius: "8px",
            }}
          >
            This scheduled reservation has reached its end time. The backend
            will determine its final status.
          </div>
        );
      }

      return (
        <button
          className="reservation-action-button"
          disabled={isLoading}
          onClick={() => handleReservationAction(reservationId, "check-in")}
        >
          {isLoading ? "Checking In..." : "CHECK IN"}
        </button>
      );
    }
    // CHECKED IN
    if (reservation.status === "CHECKED_IN") {
      return (
        <button
          className="reservation-action-button"
          disabled={isLoading}
          onClick={() =>
            handleReservationAction(reservationId, "start-charging")
          }
        >
          {isLoading ? "Starting..." : "START CHARGING"}
        </button>
      );
    }

    // CHARGING
    if (reservation.status === "CHARGING") {
      return (
        <button
          className="reservation-action-button"
          disabled={isLoading}
          onClick={() =>
            handleReservationAction(reservationId, "complete-charging")
          }
        >
          {isLoading ? "Completing..." : "COMPLETE CHARGING"}
        </button>
      );
    }

    // COMPLETED
    if (reservation.status === "COMPLETED") {
      return (
        <div className="reservation-completed-message">
          ✓ Charging completed successfully.
        </div>
      );
    }

    return null;
  };

  // ==============================
  // DASHBOARD
  // ==============================

  return (
    <div className="dashboard">
      {/* ================================= */}
      {/* HEADER */}
      {/* ================================= */}

      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-title">
            <div className="header-icon">⚡</div>

            <div>
              <h1>EV Charging Station Monitoring System</h1>

              <p>Real-Time Charging Station Dashboard</p>
            </div>
          </div>

          <div className="header-right">
            <div className="live-indicator">
              <span className="live-dot"></span>
              LIVE
            </div>

            <div className="refresh-indicator">↻ Auto-refresh: 5s</div>

            <button className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ================================= */}
      {/* MAIN CONTENT */}
      {/* ================================= */}

      <main className="dashboard-content">
        {/* ================================= */}
        {/* USER + VEHICLES */}
        {/* ================================= */}

        <section className="user-vehicle-section">
          <div className="section-heading">
            <h2>👤 User & Vehicle Information</h2>

            <p>Registered user and electric vehicle details</p>
          </div>

          <div className="user-vehicle-grid">
            {/* USER CARD */}

            <div className="user-card">
              <div className="user-card-header">
                <div className="user-card-icon">👤</div>

                <div>
                  <h3>Logged-in User</h3>

                  <p>Account information</p>
                </div>
              </div>

              {userLoading ? (
                <div className="small-loading">Loading user information...</div>
              ) : user ? (
                <div className="user-details">
                  <div className="detail-row">
                    <span>Name</span>

                    <strong>{user.name || "Not available"}</strong>
                  </div>

                  <div className="detail-row">
                    <span>Email</span>

                    <strong>{user.email || "Not available"}</strong>
                  </div>

                  <div className="detail-row">
                    <span>Phone</span>

                    <strong>{user.phone || "Not provided"}</strong>
                  </div>

                  <div className="detail-row">
                    <span>User ID</span>

                    <strong className="small-text">
                      {user._id || "Not available"}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="empty-state">No logged-in user found.</div>
              )}
            </div>

            {/* VEHICLES CARD */}

            <div className="vehicles-card">
              <div className="vehicles-card-header">
                <div className="vehicles-card-icon">🚗</div>

                <div>
                  <h3>Registered Vehicles</h3>

                  <p>
                    {vehicles.length}{" "}
                    {vehicles.length === 1 ? "vehicle" : "vehicles"} registered
                  </p>
                </div>
              </div>

              {vehicleLoading ? (
                <div className="small-loading">Loading vehicles...</div>
              ) : vehicles.length > 0 ? (
                <div className="vehicle-list">
                  {vehicles.map((vehicle) => (
                    <div className="vehicle-card" key={vehicle._id}>
                      <div className="vehicle-icon">⚡</div>

                      <div className="vehicle-details">
                        <h4>{vehicle.vehicleModel}</h4>

                        <p>
                          Vehicle Number:{" "}
                          <strong>{vehicle.vehicleNumber}</strong>
                        </p>

                        <p>
                          Battery Capacity:{" "}
                          <strong>{vehicle.batteryCapacity} kWh</strong>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">🚗</div>

                  <p>No vehicles registered.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ================================= */}
        {/* RESERVE A CHARGING SLOT */}
        {/* ================================= */}

        <section className="reservation-section">
          <div className="section-heading">
            <h2>🔌 Reserve a Charging Slot</h2>

            <p>Select your vehicle and an available physical charging slot</p>
          </div>

          {/* CREATE RESERVATION MESSAGE */}

          {reservationCreateMessage && (
            <div
              className={
                reservationCreateMessageIsError
                  ? "reservation-action-message reservation-action-error"
                  : "reservation-action-message"
              }
            >
              {reservationCreateMessage}
            </div>
          )}

          {/* RESERVATION FORM */}

          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              marginBottom: "20px",
              boxShadow: "0 8px 25px rgba(0, 0, 0, 0.08)",
              border: "1px solid #e5e7eb",
            }}
          >
            {/* RESERVATION TYPE */}

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontWeight: "600",
                  marginBottom: "8px",
                }}
              >
                Reservation Type
              </label>

              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="reservationType"
                    value="immediate"
                    checked={reservationType === "immediate"}
                    onChange={() => {
                      setReservationType("immediate");
                      setSelectedSlotNumber("");
                      setReservationCreateMessage("");
                      setReservationCreateMessageIsError(false);
                    }}
                    disabled={reservationCreateLoading || queueLoading}
                  />
                  Immediate Reservation
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="reservationType"
                    value="scheduled"
                    checked={reservationType === "scheduled"}
                    onChange={() => {
                      setReservationType("scheduled");
                      setSelectedSlotNumber("");
                      setReservationCreateMessage("");
                      setReservationCreateMessageIsError(false);
                    }}
                    disabled={reservationCreateLoading || queueLoading}
                  />
                  Schedule for Later
                </label>
              </div>
            </div>

            {/* SCHEDULED TIMES */}

            {reservationType === "scheduled" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                  marginBottom: "20px",
                  padding: "16px",
                  borderRadius: "10px",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: "600",
                      marginBottom: "8px",
                    }}
                  >
                    Scheduled Start
                  </label>

                  <input
                    type="datetime-local"
                    value={scheduledStartTime}
                    onChange={(event) =>
                      setScheduledStartTime(event.target.value)
                    }
                    min={new Date(Date.now() + 60000)
                      .toISOString()
                      .slice(0, 16)}
                    disabled={reservationCreateLoading || queueLoading}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontWeight: "600",
                      marginBottom: "8px",
                    }}
                  >
                    Scheduled End
                  </label>

                  <input
                    type="datetime-local"
                    value={scheduledEndTime}
                    onChange={(event) =>
                      setScheduledEndTime(event.target.value)
                    }
                    min={
                      scheduledStartTime
                        ? new Date(
                            new Date(scheduledStartTime).getTime() + 60000,
                          )
                            .toISOString()
                            .slice(0, 16)
                        : undefined
                    }
                    disabled={reservationCreateLoading || queueLoading}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <p
                  style={{
                    gridColumn: "1 / -1",
                    margin: "0",
                    color: "#1e40af",
                    fontSize: "14px",
                  }}
                >
                  Choose a future time interval. A scheduled slot does not need
                  to be physically vacant right now, but the backend must
                  confirm that the requested interval does not conflict with
                  another reservation.
                </p>
              </div>
            )}
            {/* VEHICLE */}

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontWeight: "600",
                  marginBottom: "8px",
                }}
              >
                Select Vehicle
              </label>

              <select
                value={selectedVehicleId}
                onChange={(event) => setSelectedVehicleId(event.target.value)}
                disabled={
                  reservationCreateLoading ||
                  queueLoading ||
                  vehicles.length === 0
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "15px",
                  background: "#ffffff",
                }}
              >
                <option value="">
                  {vehicles.length === 0
                    ? "No vehicles available"
                    : "Choose your vehicle"}
                </option>

                {vehicles.map((vehicle) => (
                  <option key={vehicle._id} value={vehicle._id}>
                    {vehicle.vehicleModel} - {vehicle.vehicleNumber}
                  </option>
                ))}
              </select>
            </div>

            {/* SLOT */}

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontWeight: "600",
                  marginBottom: "8px",
                }}
              >
                Select Charging Slot
              </label>

              <select
                value={selectedSlotNumber}
                onChange={(event) => setSelectedSlotNumber(event.target.value)}
                disabled={
                  reservationCreateLoading ||
                  queueLoading ||
                  (reservationType === "immediate" &&
                    availableSlotList.length === 0)
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "15px",
                  background: "#ffffff",
                }}
              >
                <option value="">
                  {reservationType === "immediate"
                    ? availableSlotList.length === 0
                      ? "No charging slots currently available"
                      : "Choose an available slot"
                    : "Choose a slot for your scheduled reservation"}
                </option>

                {(reservationType === "immediate"
                  ? availableSlotList
                  : slots
                ).map((slot) => (
                  <option key={slot.number} value={slot.number}>
                    Slot {slot.number}
                    {reservationType === "immediate"
                      ? " - AVAILABLE"
                      : slot.occupied
                        ? " - OCCUPIED NOW (check scheduled availability)"
                        : " - AVAILABLE NOW"}
                  </option>
                ))}
              </select>
            </div>

            {/* RESERVE BUTTON */}

            <button
              onClick={handleCreateReservation}
              disabled={
                reservationCreateLoading ||
                queueLoading ||
                !station?._id ||
                !selectedVehicleId ||
                !selectedSlotNumber ||
                (reservationType === "immediate" &&
                  availableSlotList.length === 0) ||
                (reservationType === "scheduled" &&
                  (!scheduledStartTime || !scheduledEndTime))
              }
              style={{
                width: "100%",
                padding: "13px 20px",
                border: "none",
                borderRadius: "8px",
                background:
                  reservationCreateLoading ||
                  queueLoading ||
                  !selectedVehicleId ||
                  !selectedSlotNumber ||
                  availableSlotList.length === 0
                    ? "#9ca3af"
                    : "#16a34a",
                color: "#ffffff",
                fontSize: "15px",
                fontWeight: "700",
                cursor:
                  reservationCreateLoading ||
                  queueLoading ||
                  !selectedVehicleId ||
                  !selectedSlotNumber ||
                  availableSlotList.length === 0
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {reservationCreateLoading
                ? "PROCESSING..."
                : reservationType === "scheduled"
                  ? "SCHEDULE RESERVATION"
                  : "RESERVE SLOT"}
            </button>

            {/* NO SLOT MESSAGE */}

            {isStationFull && (
              <p
                style={{
                  marginTop: "12px",
                  marginBottom: "0",
                  textAlign: "center",
                  color: "#dc2626",
                  fontWeight: "600",
                }}
              >
                All physical charging slots are currently occupied.
              </p>
            )}
          </div>

          {/* ================================= */}
          {/* QUEUE SECTION */}
          {/* ================================= */}

          {isStationFull && (
            <div
              style={{
                background: "#ffffff",
                borderRadius: "16px",
                padding: "24px",
                marginBottom: "30px",
                boxShadow: "0 8px 25px rgba(0, 0, 0, 0.08)",
                border: "1px solid #fed7aa",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <div style={{ fontSize: "28px" }}>⏳</div>

                <div>
                  <h3
                    style={{
                      margin: "0",
                      fontSize: "20px",
                    }}
                  >
                    Charging Station Full
                  </h3>

                  <p
                    style={{
                      margin: "4px 0 0",
                      color: "#6b7280",
                    }}
                  >
                    You can join the queue and wait for the next available
                    charging slot.
                  </p>
                </div>
              </div>

              {/* QUEUE MESSAGE */}

              {queueMessage && (
                <div
                  style={{
                    marginBottom: "18px",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: queueMessageIsError ? "#fef2f2" : "#ecfdf5",
                    color: queueMessageIsError ? "#b91c1c" : "#166534",
                    border: queueMessageIsError
                      ? "1px solid #fecaca"
                      : "1px solid #bbf7d0",
                    fontWeight: "600",
                  }}
                >
                  {queueMessage}
                </div>
              )}

              {/* QUEUE VEHICLE */}

              <label
                style={{
                  display: "block",
                  fontWeight: "600",
                  marginBottom: "8px",
                }}
              >
                Select Vehicle for Queue
              </label>

              <select
                value={selectedVehicleId}
                onChange={(event) => setSelectedVehicleId(event.target.value)}
                disabled={queueLoading || vehicles.length === 0}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "15px",
                  background: "#ffffff",
                  marginBottom: "16px",
                }}
              >
                <option value="">
                  {vehicles.length === 0
                    ? "No vehicles available"
                    : "Choose your vehicle"}
                </option>

                {vehicles.map((vehicle) => (
                  <option key={vehicle._id} value={vehicle._id}>
                    {vehicle.vehicleModel} - {vehicle.vehicleNumber}
                  </option>
                ))}
              </select>

              {/* JOIN QUEUE BUTTON */}

              <button
                onClick={handleJoinQueue}
                disabled={
                  queueLoading || reservationCreateLoading || !selectedVehicleId
                }
                style={{
                  width: "100%",
                  padding: "13px 20px",
                  border: "none",
                  borderRadius: "8px",
                  background:
                    queueLoading ||
                    reservationCreateLoading ||
                    !selectedVehicleId
                      ? "#9ca3af"
                      : "#ea580c",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: "700",
                  cursor:
                    queueLoading ||
                    reservationCreateLoading ||
                    !selectedVehicleId
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {queueLoading ? "JOINING QUEUE..." : "JOIN QUEUE"}
              </button>
            </div>
          )}
        </section>

        {/* ================================= */}
        {/* MY RESERVATIONS */}
        {/* ================================= */}

        <section className="reservation-section">
          <div className="section-heading">
            <h2>📅 My Reservations</h2>

            <p>Your charging station reservations</p>
          </div>

          {reservationActionMessage && (
            <div
              className={
                reservationActionMessageIsError
                  ? "reservation-action-message reservation-action-error"
                  : "reservation-action-message"
              }
            >
              {reservationActionMessage}
            </div>
          )}

          {reservationLoading ? (
            <div className="reservation-loading">
              <div className="reservation-loading-spinner"></div>

              <span>Loading reservations...</span>
            </div>
          ) : reservations.length === 0 ? (
            <div className="reservation-empty">
              <div className="reservation-empty-icon">📅</div>

              <h3>No reservations</h3>

              <p>You currently have no charging station reservations.</p>
            </div>
          ) : (
            <div className="reservation-grid">
              {reservations.map((reservation) => {
                const statusClass =
                  reservation.status?.toLowerCase().replace(/_/g, "-") ||
                  "reserved";

                return (
                  <div className="reservation-card" key={reservation._id}>
                    {/* RESERVATION HEADER */}

                    <div className="reservation-card-header">
                      <div className="reservation-title">
                        <div className="reservation-icon">🔌</div>

                        <div>
                          <h3>{reservation.stationId}</h3>

                          <p>Charging Station Reservation</p>
                        </div>
                      </div>

                      <span
                        className={
                          "reservation-status reservation-status-" + statusClass
                        }
                      >
                        {reservation.status}
                      </span>
                    </div>

                    {/* RESERVATION DETAILS */}

                    <div className="reservation-details">
                      {/* SLOT / QUEUE POSITION */}

                      <div className="reservation-detail">
                        <span className="reservation-detail-icon">
                          {reservation.status === "WAITING" ? "⏳" : "🔌"}
                        </span>

                        <div>
                          <small>
                            {reservation.status === "WAITING"
                              ? "Queue Position"
                              : "Reserved Slot"}
                          </small>

                          <strong>
                            {reservation.status === "WAITING"
                              ? `#${reservation.queuePosition ?? "N/A"}`
                              : `Slot ${
                                  reservation.slotNumber ?? "Not assigned"
                                }`}
                          </strong>
                        </div>
                      </div>

                      {/* VEHICLE */}

                      <div className="reservation-detail">
                        <span className="reservation-detail-icon">🚗</span>

                        <div>
                          <small>Vehicle</small>

                          <strong>
                            {reservation.vehicle?.vehicleModel ||
                              "Unknown Vehicle"}
                          </strong>
                        </div>
                      </div>

                      {/* VEHICLE NUMBER */}

                      <div className="reservation-detail">
                        <span className="reservation-detail-icon">🔢</span>

                        <div>
                          <small>Vehicle Number</small>

                          <strong>
                            {reservation.vehicle?.vehicleNumber || "N/A"}
                          </strong>
                        </div>
                      </div>

                      {/* BATTERY */}

                      <div className="reservation-detail">
                        <span className="reservation-detail-icon">🔋</span>

                        <div>
                          <small>Battery Capacity</small>

                          <strong>
                            {reservation.vehicle?.batteryCapacity ?? 0} kWh
                          </strong>
                        </div>
                      </div>

                      {/* RESERVED AT */}

                      <div className="reservation-detail reservation-detail-wide">
                        <span className="reservation-detail-icon">🕒</span>

                        <div>
                          <small>
                            {reservation.status === "WAITING"
                              ? "Joined Queue At"
                              : "Reserved At"}
                          </small>

                          <strong>
                            {formatReservationDate(
                              reservation.status === "WAITING"
                                ? reservation.queuedAt
                                : reservation.reservedAt,
                            )}
                          </strong>
                        </div>
                      </div>
                      {/* SCHEDULED RESERVATION TIMES */}

                      {reservation.isScheduled &&
                        reservation.scheduledStartTime &&
                        reservation.scheduledEndTime && (
                          <>
                            <div className="reservation-detail reservation-detail-wide">
                              <span className="reservation-detail-icon">
                                📅
                              </span>

                              <div>
                                <small>Scheduled Start</small>
                                <strong>
                                  {formatReservationDate(
                                    reservation.scheduledStartTime,
                                  )}
                                </strong>
                              </div>
                            </div>

                            <div className="reservation-detail reservation-detail-wide">
                              <span className="reservation-detail-icon">
                                🕒
                              </span>

                              <div>
                                <small>Scheduled End</small>
                                <strong>
                                  {formatReservationDate(
                                    reservation.scheduledEndTime,
                                  )}
                                </strong>
                              </div>
                            </div>
                          </>
                        )}

                      {/* CHECK-IN TIME */}

                      {(reservation.status === "CHECKED_IN" ||
                        reservation.status === "CHARGING" ||
                        reservation.status === "COMPLETED") &&
                        reservation.checkInTime && (
                          <div className="reservation-detail reservation-detail-wide">
                            <span className="reservation-detail-icon">✅</span>

                            <div>
                              <small>Checked In</small>

                              <strong>
                                {formatReservationDate(reservation.checkInTime)}
                              </strong>
                            </div>
                          </div>
                        )}

                      {/* CHARGING START TIME */}

                      {(reservation.status === "CHARGING" ||
                        reservation.status === "COMPLETED") &&
                        reservation.chargingStartTime && (
                          <div className="reservation-detail reservation-detail-wide">
                            <span className="reservation-detail-icon">⚡</span>

                            <div>
                              <small>Charging Started</small>

                              <strong>
                                {formatReservationDate(
                                  reservation.chargingStartTime,
                                )}
                              </strong>
                            </div>
                          </div>
                        )}

                      {/* CHARGING END TIME */}

                      {reservation.status === "COMPLETED" &&
                        reservation.chargingEndTime && (
                          <div className="reservation-detail reservation-detail-wide">
                            <span className="reservation-detail-icon">🏁</span>

                            <div>
                              <small>Charging Completed</small>

                              <strong>
                                {formatReservationDate(
                                  reservation.chargingEndTime,
                                )}
                              </strong>
                            </div>
                          </div>
                        )}
                    </div>

                    {/* RESERVATION ACTION */}

                    <div className="reservation-action-area">
                      {renderReservationAction(reservation)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        {/* ================================= */}
        {/* ML WAITING-TIME PREDICTION */}
        {/* ================================= */}

        <section className="reservation-section">
          <div className="section-heading">
            <h2>🤖 AI Waiting-Time Prediction</h2>

            <p>
              Estimate your queue waiting time using the Random Forest
              machine-learning model.
            </p>
          </div>

          <div className="ml-prediction-card">
            <div className="ml-prediction-header">
              <div className="ml-prediction-icon">⏱️</div>

              <div>
                <h3>Predicted Waiting Time</h3>
                <p>Python ML service · RandomForestRegressor</p>
              </div>
            </div>

            {mlPrediction ? (
              <div className="ml-prediction-results">
                <div className="ml-prediction-metrics">
                  <div className="ml-metric">
                    <span>Queue position</span>
                    <strong>#{mlPrediction.queuePosition}</strong>
                  </div>

                  <div className="ml-metric">
                    <span>Active charging sessions</span>
                    <strong>{mlPrediction.activeChargingSessions}</strong>
                  </div>

                  <div className="ml-metric ml-metric-highlight">
                    <span>Estimated waiting time</span>
                    <strong>{mlPrediction.estimatedWaitMinutes} min</strong>
                  </div>
                </div>

                <p className="ml-prediction-note">
                  Experimental estimate based on synthetic training data. It has
                  not been validated against real-world waiting times.
                </p>
              </div>
            ) : (
              <p className="ml-prediction-description">
                Join the charging queue first, then request a prediction for
                your current queue position.
              </p>
            )}

            {mlPredictionError && (
              <div className="error-banner ml-prediction-error">
                ⚠️ {mlPredictionError}
              </div>
            )}

            <button
              className="ml-prediction-button"
              onClick={fetchMyWaitPrediction}
              disabled={mlPredictionLoading}
            >
              {mlPredictionLoading
                ? "Calculating prediction..."
                : "Predict My Waiting Time"}
            </button>
          </div>
        </section>

        {/* ================================= */}
        {/* STATION HEADER */}
        {/* ================================= */}

        <section className="station-header">
          <div className="station-information">
            <div className="station-icon">⚡</div>

            <div>
              <h2>{station?.name || "KIIT EV Charging Station"}</h2>

              <p>
                📍{" "}
                {station?.address ||
                  "KIIT Deemed to be University, Bhubaneswar, Odisha"}
              </p>
            </div>
          </div>

          <div className="station-status-container">
            <div
              className={
                "station-status " +
                (stationStatus.toLowerCase().includes("available")
                  ? "status-available"
                  : stationStatus.toLowerCase().includes("busy")
                    ? "status-busy"
                    : "status-offline")
              }
            >
              🟢 {stationStatus}
            </div>

            <p className="status-description">
              {availableSlots > 0
                ? "Charging slots are currently available"
                : "All charging slots are occupied"}
            </p>
          </div>
        </section>

        {/* ================================= */}
        {/* ERROR */}
        {/* ================================= */}

        {error && <div className="error-banner">⚠️ {error}</div>}

        {/* ================================= */}
        {/* STAT CARDS */}
        {/* ================================= */}

        <section className="stats-grid">
          {/* BATTERY */}

          <div className="stat-card">
            <div className="stat-icon battery-icon">🔋</div>

            <div className="stat-content">
              <span className="stat-label">Battery</span>

              <span className="stat-value">{batteryPercentage}%</span>

              <div className="progress-container">
                <div
                  className="progress-bar battery-progress"
                  style={{
                    width: Math.min(Math.max(batteryPercentage, 0), 100) + "%",
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* POWER */}

          <div className="stat-card">
            <div className="stat-icon power-icon">⚡</div>

            <div className="stat-content">
              <span className="stat-label">Charging Power</span>

              <span className="stat-value">{chargingPower} kW</span>
            </div>
          </div>

          {/* SLOTS */}

          <div className="stat-card">
            <div className="stat-icon slots-icon">🅿️</div>

            <div className="stat-content">
              <span className="stat-label">Available Slots</span>

              <span className="stat-value">
                {availableSlots} / {totalSlots}
              </span>
            </div>
          </div>

          {/* PRICE */}

          <div className="stat-card">
            <div className="stat-icon price-icon">₹</div>

            <div className="stat-content">
              <span className="stat-label">Price</span>

              <span className="stat-value">₹{pricePerKwh}/kWh</span>
            </div>
          </div>
        </section>

        {/* ================================= */}
        {/* SLOT STATUS */}
        {/* ================================= */}

        <section className="slot-status-section">
          <div className="section-title">
            <div>
              <h2>Charging Slot Status</h2>

              <p>
                {availableSlots} of {totalSlots} slots available
              </p>
            </div>
          </div>

          <div className="slot-status-grid">
            {slots.map((slot) => (
              <div
                key={slot.number}
                className={
                  "slot-card " +
                  (slot.occupied ? "slot-occupied" : "slot-available")
                }
              >
                <div className="slot-card-icon">
                  {slot.occupied ? "🔴" : "🟢"}
                </div>

                <div className="slot-card-content">
                  <h3>Slot {slot.number}</h3>

                  <p>{slot.occupied ? "OCCUPIED" : "AVAILABLE"}</p>
                </div>

                <div className="slot-status-indicator"></div>
              </div>
            ))}
          </div>
        </section>

        {/* ================================= */}
        {/* SECONDARY INFORMATION */}
        {/* ================================= */}

        <section className="secondary-grid">
          <div className="info-card">
            <div className="info-card-icon">⚡</div>

            <div>
              <span className="stat-label">Energy Consumed</span>

              <span className="large-value">
                {energyConsumed} <span>kWh</span>
              </span>
            </div>
          </div>

          <div className="info-card">
            <div className="info-card-icon">⏱️</div>

            <div>
              <span className="stat-label">Estimated Completion</span>

              <span className="large-value">
                {estimatedCompletionTime} <span>min</span>
              </span>
            </div>
          </div>

          <div className="info-card">
            <div className="info-card-icon">📍</div>

            <div>
              <span className="stat-label">Station Location</span>

              <span className="large-value">
                {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </span>
            </div>
          </div>
        </section>

        {/* ================================= */}
        {/* MAP */}
        {/* ================================= */}

        <section className="map-section">
          <div className="section-title">
            <div>
              <h2>Station Location</h2>

              <p>KIIT, Bhubaneswar</p>
            </div>

            <div className="map-status">🟢 Map active</div>
          </div>

          <div className="map-container">
            <MapContainer
              center={[latitude, longitude]}
              zoom={16}
              scrollWheelZoom={true}
              style={{
                height: "100%",
                width: "100%",
              }}
            >
              <MapUpdater latitude={latitude} longitude={longitude} />

              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <Marker position={[latitude, longitude]}>
                <Popup>
                  <strong>{station?.name || "KIIT EV Charging Station"}</strong>
                  <br />
                  {station?.address || "KIIT, Bhubaneswar"}
                  <br />
                  Available Slots: {availableSlots}/{totalSlots}
                </Popup>
              </Marker>
            </MapContainer>
          </div>
        </section>

        {/* ================================= */}
        {/* FOOTER */}
        {/* ================================= */}

        <footer className="dashboard-footer">
          <div>
            Backend: <span className="backend-connected">● Connected</span>
          </div>

          <div>Last updated: {formattedLastUpdated}</div>
        </footer>
      </main>
    </div>
  );
}

export default App;
