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
  // LOGIN STATE
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
  // TOKEN
  // ==============================

  const getToken = () => {
    return localStorage.getItem("token");
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
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load profile");
      }

      setUser(data.user);
    } catch (err) {
      console.error("Profile fetch error:", err);

      // If token is invalid/expired
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
          Authorization: `Bearer ${token}`,
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
      // LOAD USER + VEHICLES
      // ==============================

      await fetchUserProfile();
      await fetchVehicles();
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

    setIsLoggedIn(false);

    setLoginMessage("");
    setLoginMessageIsError(false);
  };

  // ==============================
  // INITIAL LOAD
  // ==============================

  useEffect(() => {
    fetchStation();

    if (getToken()) {
      fetchUserProfile();
      fetchVehicles();
    }

    const interval = setInterval(() => {
      fetchStation();
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
  // FORMAT DATE
  // ==============================

  const formattedLastUpdated = lastUpdated
    ? lastUpdated.toLocaleString()
    : "Not available";

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
              className={`station-status ${
                stationStatus.toLowerCase().includes("available")
                  ? "status-available"
                  : stationStatus.toLowerCase().includes("busy")
                    ? "status-busy"
                    : "status-offline"
              }`}
            >
              🟢 {stationStatus}
            </div>

            <p>
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
                    width: `${Math.min(Math.max(batteryPercentage, 0), 100)}%`,
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
                className={`slot-card ${
                  slot.occupied ? "slot-occupied" : "slot-available"
                }`}
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

              <span className="large-value">{energyConsumed} kWh</span>
            </div>
          </div>

          <div className="info-card">
            <div className="info-card-icon">⏱️</div>

            <div>
              <span className="stat-label">Estimated Completion</span>

              <span className="large-value">{estimatedCompletionTime} min</span>
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
