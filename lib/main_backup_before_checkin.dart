import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const EVChargingApp());
}

// ===============================
// BACKEND URLS
// ===============================

const String backendUrl = 'http://127.0.0.1:5000/api/stations/slots';

const String registerUrl = 'http://127.0.0.1:5000/api/auth/register';

const String loginUrl = 'http://127.0.0.1:5000/api/auth/login';

const String vehicleUrl = 'http://127.0.0.1:5000/api/vehicles';

const String myVehiclesUrl = 'http://127.0.0.1:5000/api/vehicles/my';

const String myReservationsUrl = 'http://127.0.0.1:5000/api/reservations/my';

// ===============================
// APP
// ===============================

class EVChargingApp extends StatelessWidget {
  const EVChargingApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'EV Charging Station',
      theme: ThemeData(
        primarySwatch: Colors.green,
        scaffoldBackgroundColor: const Color(0xFFF5F7FA),
      ),
      home: const AuthGate(),
    );
  }
}

// ===============================
// AUTH GATE
// ===============================

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  String? authToken;
  Map<String, dynamic>? loggedInUser;

  bool showRegister = false;

  void handleLogin(String token, Map<String, dynamic> user) {
    setState(() {
      authToken = token;
      loggedInUser = user;
    });
  }

  void handleLogout() {
    setState(() {
      authToken = null;
      loggedInUser = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (authToken != null && loggedInUser != null) {
      return EVChargingHomePage(
        user: loggedInUser!,
        token: authToken!,
        onLogout: handleLogout,
      );
    }

    if (showRegister) {
      return RegisterPage(
        onRegisterSuccess: () {
          setState(() {
            showRegister = false;
          });
        },
        onBackToLogin: () {
          setState(() {
            showRegister = false;
          });
        },
      );
    }

    return LoginPage(
      onLoginSuccess: handleLogin,
      onGoToRegister: () {
        setState(() {
          showRegister = true;
        });
      },
    );
  }
}

// ===============================
// LOGIN PAGE
// ===============================

class LoginPage extends StatefulWidget {
  final void Function(String token, Map<String, dynamic> user) onLoginSuccess;

  final VoidCallback onGoToRegister;

  const LoginPage({
    super.key,
    required this.onLoginSuccess,
    required this.onGoToRegister,
  });

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final TextEditingController emailController = TextEditingController();

  final TextEditingController passwordController = TextEditingController();

  bool isLoading = false;
  String? errorMessage;

  Future<void> login() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final response = await http.post(
        Uri.parse(loginUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': emailController.text.trim(),
          'password': passwordController.text,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final token = data['token'];

        final user = Map<String, dynamic>.from(data['user']);

        widget.onLoginSuccess(token.toString(), user);
      } else {
        if (mounted) {
          setState(() {
            errorMessage = data['message'] ?? 'Login failed';
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          errorMessage = 'Could not connect to backend.';
        });
      }
    }

    if (mounted) {
      setState(() {
        isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                const Icon(Icons.ev_station, size: 80, color: Colors.green),

                const SizedBox(height: 20),

                const Text(
                  'EV Charging Station',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                ),

                const SizedBox(height: 8),

                const Text(
                  'Login to continue',
                  style: TextStyle(color: Colors.grey, fontSize: 16),
                ),

                const SizedBox(height: 30),

                TextField(
                  controller: emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.email),
                  ),
                ),

                const SizedBox(height: 16),

                TextField(
                  controller: passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Password',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.lock),
                  ),
                ),

                const SizedBox(height: 16),

                if (errorMessage != null)
                  Text(
                    errorMessage!,
                    style: const TextStyle(color: Colors.red),
                  ),

                const SizedBox(height: 16),

                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: isLoading ? null : login,
                    child: isLoading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text('LOGIN', style: TextStyle(fontSize: 16)),
                  ),
                ),

                const SizedBox(height: 12),

                TextButton(
                  onPressed: widget.onGoToRegister,
                  child: const Text('Create a new account'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ===============================
// REGISTER PAGE
// ===============================

class RegisterPage extends StatefulWidget {
  final VoidCallback onRegisterSuccess;
  final VoidCallback onBackToLogin;

  const RegisterPage({
    super.key,
    required this.onRegisterSuccess,
    required this.onBackToLogin,
  });

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final TextEditingController nameController = TextEditingController();

  final TextEditingController emailController = TextEditingController();

  final TextEditingController passwordController = TextEditingController();

  final TextEditingController phoneController = TextEditingController();

  bool isLoading = false;
  String? message;
  bool isError = false;

  Future<void> register() async {
    setState(() {
      isLoading = true;
      message = null;
    });

    try {
      final response = await http.post(
        Uri.parse(registerUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'name': nameController.text.trim(),
          'email': emailController.text.trim(),
          'password': passwordController.text,
          'phone': phoneController.text.trim(),
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 201 && data['success'] == true) {
        setState(() {
          isError = false;
          message = 'Registration successful. Please login.';
        });

        await Future.delayed(const Duration(seconds: 1));

        widget.onRegisterSuccess();
      } else {
        setState(() {
          isError = true;
          message = data['message'] ?? 'Registration failed';
        });
      }
    } catch (e) {
      setState(() {
        isError = true;
        message = 'Could not connect to backend.';
      });
    }

    if (mounted) {
      setState(() {
        isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    nameController.dispose();
    emailController.dispose();
    passwordController.dispose();
    phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                const Icon(Icons.person_add, size: 70, color: Colors.green),

                const SizedBox(height: 20),

                const Text(
                  'Create Account',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                ),

                const SizedBox(height: 25),

                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'Name',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.person),
                  ),
                ),

                const SizedBox(height: 15),

                TextField(
                  controller: emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.email),
                  ),
                ),

                const SizedBox(height: 15),

                TextField(
                  controller: passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Password',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.lock),
                  ),
                ),

                const SizedBox(height: 15),

                TextField(
                  controller: phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Phone',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.phone),
                  ),
                ),

                const SizedBox(height: 15),

                if (message != null)
                  Text(
                    message!,
                    style: TextStyle(
                      color: isError ? Colors.red : Colors.green,
                    ),
                  ),

                const SizedBox(height: 15),

                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: isLoading ? null : register,
                    child: isLoading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text(
                            'REGISTER',
                            style: TextStyle(fontSize: 16),
                          ),
                  ),
                ),

                const SizedBox(height: 10),

                TextButton(
                  onPressed: widget.onBackToLogin,
                  child: const Text('Already have an account? Login'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ============================================================
// EV CHARGING HOME PAGE
// ============================================================

class EVChargingHomePage extends StatefulWidget {
  final Map<String, dynamic> user;

  final String token;

  final VoidCallback onLogout;

  const EVChargingHomePage({
    super.key,
    required this.user,
    required this.token,
    required this.onLogout,
  });

  @override
  State<EVChargingHomePage> createState() => _EVChargingHomePageState();
}

class _EVChargingHomePageState extends State<EVChargingHomePage> {
  // ==========================================================
  // BLE
  // ==========================================================

  BluetoothDevice? connectedDevice;

  BluetoothCharacteristic? characteristic;

  StreamSubscription<List<ScanResult>>? scanSubscription;

  StreamSubscription<BluetoothConnectionState>? connectionSubscription;

  StreamSubscription<List<int>>? characteristicSubscription;

  bool isScanning = false;
  bool isConnected = false;

  int slot1State = 0;
  int slot2State = 0;
  int slot3State = 0;
  int slot4State = 0;

  String connectionStatus = 'Searching for KIIT EV Charging Station...';

  Timer? backendTimer;

  // ==========================================================
  // VEHICLE
  // ==========================================================

  List<Map<String, dynamic>> vehicles = [];

  bool isLoadingVehicles = false;
  bool isAddingVehicle = false;

  String? vehicleMessage;
  bool vehicleMessageIsError = false;

  final TextEditingController vehicleNumberController = TextEditingController();

  final TextEditingController vehicleModelController = TextEditingController();

  final TextEditingController batteryCapacityController =
      TextEditingController();

  // ==========================================================
  // RESERVATIONS
  // ==========================================================

  List<Map<String, dynamic>> reservations = [];

  bool isLoadingReservations = false;

  String? reservationMessage;

  bool reservationMessageIsError = false;

  // ==========================================================
  // BLE UUIDs
  // ==========================================================

  final Guid serviceUuid = Guid('4fafc201-1fb5-459e-8fcc-c5c9c331914b');

  final Guid characteristicUuid = Guid('beb5483e-36e1-4688-b7f5-ea07361b26a8');

  // ==========================================================
  // SLOT COUNTS
  // ==========================================================

  int get occupiedSlots {
    return slot1State + slot2State + slot3State + slot4State;
  }

  int get availableSlots {
    return 4 - occupiedSlots;
  }

  // ==========================================================
  // INIT
  // ==========================================================

  @override
  void initState() {
    super.initState();

    startBleScan();

    loadVehicles();

    loadReservations();
  }

  // ==========================================================
  // VEHICLE - LOAD
  // ==========================================================

  Future<void> loadVehicles() async {
    if (!mounted) return;

    setState(() {
      isLoadingVehicles = true;
      vehicleMessage = null;
    });

    try {
      final response = await http.get(
        Uri.parse(myVehiclesUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);

        if (data['success'] == true) {
          final List<dynamic> vehicleList = data['vehicles'] ?? [];

          if (mounted) {
            setState(() {
              vehicles = vehicleList
                  .map((vehicle) => Map<String, dynamic>.from(vehicle))
                  .toList();
            });
          }
        } else {
          if (mounted) {
            setState(() {
              vehicleMessage = data['message'] ?? 'Could not load vehicles.';
              vehicleMessageIsError = true;
            });
          }
        }
      } else {
        if (mounted) {
          setState(() {
            vehicleMessage = 'Could not load vehicles.';
            vehicleMessageIsError = true;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          vehicleMessage = 'Could not connect to backend.';
          vehicleMessageIsError = true;
        });
      }
    }

    if (mounted) {
      setState(() {
        isLoadingVehicles = false;
      });
    }
  }

  // ==========================================================
  // RESERVATIONS - LOAD
  // ==========================================================

  Future<void> loadReservations() async {
    if (!mounted) return;

    setState(() {
      isLoadingReservations = true;
      reservationMessage = null;
      reservationMessageIsError = false;
    });

    try {
      final response = await http.get(
        Uri.parse(myReservationsUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final List<dynamic> reservationList = data['reservations'] ?? [];

        if (mounted) {
          setState(() {
            reservations = reservationList
                .map((reservation) => Map<String, dynamic>.from(reservation))
                .toList();
          });
        }
      } else {
        if (mounted) {
          setState(() {
            reservationMessage =
                data['message'] ?? 'Could not load reservations.';
            reservationMessageIsError = true;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          reservationMessage = 'Could not connect to backend.';
          reservationMessageIsError = true;
        });
      }
    }

    if (mounted) {
      setState(() {
        isLoadingReservations = false;
      });
    }
  }

  // ==========================================================
  // VEHICLE - ADD
  // ==========================================================

  Future<void> addVehicle() async {
    final vehicleNumber = vehicleNumberController.text.trim();

    final vehicleModel = vehicleModelController.text.trim();

    final batteryText = batteryCapacityController.text.trim();

    if (vehicleNumber.isEmpty || vehicleModel.isEmpty || batteryText.isEmpty) {
      setState(() {
        vehicleMessage = 'Please fill all vehicle fields.';
        vehicleMessageIsError = true;
      });

      return;
    }

    final batteryCapacity = double.tryParse(batteryText);

    if (batteryCapacity == null || batteryCapacity <= 0) {
      setState(() {
        vehicleMessage = 'Enter a valid battery capacity.';
        vehicleMessageIsError = true;
      });

      return;
    }

    setState(() {
      isAddingVehicle = true;
      vehicleMessage = null;
    });

    try {
      final response = await http.post(
        Uri.parse(vehicleUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
        body: jsonEncode({
          'vehicleNumber': vehicleNumber.toUpperCase(),
          'vehicleModel': vehicleModel,
          'batteryCapacity': batteryCapacity,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 201 && data['success'] == true) {
        if (mounted) {
          setState(() {
            vehicleMessage = 'Vehicle registered successfully.';
            vehicleMessageIsError = false;
          });
        }

        vehicleNumberController.clear();
        vehicleModelController.clear();
        batteryCapacityController.clear();

        await loadVehicles();
      } else {
        if (mounted) {
          setState(() {
            vehicleMessage = data['message'] ?? 'Vehicle registration failed.';
            vehicleMessageIsError = true;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          vehicleMessage = 'Could not connect to backend.';
          vehicleMessageIsError = true;
        });
      }
    }

    if (mounted) {
      setState(() {
        isAddingVehicle = false;
      });
    }
  }

  // ==========================================================
  // VEHICLE CARD
  // ==========================================================

  Widget buildVehicleCard(Map<String, dynamic> vehicle) {
    final vehicleNumber = vehicle['vehicleNumber']?.toString() ?? 'Unknown';

    final vehicleModel = vehicle['vehicleModel']?.toString() ?? 'Unknown';

    final batteryCapacity = vehicle['batteryCapacity']?.toString() ?? 'Unknown';

    return Card(
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const CircleAvatar(radius: 25, child: Icon(Icons.electric_car)),

                const SizedBox(width: 12),

                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        vehicleModel,
                        style: const TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.bold,
                        ),
                      ),

                      const SizedBox(height: 4),

                      Text(
                        vehicleNumber,
                        style: const TextStyle(
                          color: Colors.grey,
                          fontSize: 15,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 15),

            const Divider(),

            const SizedBox(height: 8),

            Row(
              children: [
                const Icon(Icons.battery_full, color: Colors.green),

                const SizedBox(width: 8),

                const Text(
                  'Battery Capacity:',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),

                const SizedBox(width: 5),

                Text('$batteryCapacity kWh'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ==========================================================
  // RESERVATION CARD
  // ==========================================================

  Widget buildReservationCard(Map<String, dynamic> reservation) {
    final stationId = reservation['stationId']?.toString() ?? 'Unknown';

    final slotNumber = reservation['slotNumber']?.toString() ?? 'Unknown';

    final status = reservation['status']?.toString() ?? 'Unknown';

    final reservedAt = reservation['reservedAt']?.toString() ?? '';

    final vehicle = reservation['vehicle'];

    String vehicleModel = 'Unknown';

    String vehicleNumber = 'Unknown';

    String batteryCapacity = 'Unknown';

    if (vehicle is Map) {
      vehicleModel = vehicle['vehicleModel']?.toString() ?? 'Unknown';

      vehicleNumber = vehicle['vehicleNumber']?.toString() ?? 'Unknown';

      batteryCapacity = vehicle['batteryCapacity']?.toString() ?? 'Unknown';
    }

    DateTime? reservationDate;

    if (reservedAt.isNotEmpty) {
      reservationDate = DateTime.tryParse(reservedAt);
    }

    String formattedDate = reservationDate != null
        ? '${reservationDate.day}/'
              '${reservationDate.month}/'
              '${reservationDate.year} '
              '${reservationDate.hour}:'
              '${reservationDate.minute.toString().padLeft(2, '0')}'
        : 'Unknown';

    Color statusColor = Colors.orange;

    if (status == 'RESERVED') {
      statusColor = Colors.blue;
    } else if (status == 'CHECKED_IN') {
      statusColor = Colors.deepPurple;
    } else if (status == 'CHARGING') {
      statusColor = Colors.green;
    } else if (status == 'COMPLETED') {
      statusColor = Colors.teal;
    } else if (status == 'CANCELLED' || status == 'EXPIRED') {
      statusColor = Colors.red;
    }

    return Card(
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const CircleAvatar(
                  radius: 25,
                  child: Icon(Icons.event_available),
                ),

                const SizedBox(width: 12),

                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'My Reservation',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),

                      const SizedBox(height: 4),

                      Text(
                        '$stationId • Slot $slotNumber',
                        style: const TextStyle(color: Colors.grey),
                      ),
                    ],
                  ),
                ),

                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    status,
                    style: TextStyle(
                      color: statusColor,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 15),

            const Divider(),

            const SizedBox(height: 10),

            Row(
              children: [
                const Icon(Icons.electric_car, color: Colors.green),

                const SizedBox(width: 8),

                const Text(
                  'Vehicle:',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),

                const SizedBox(width: 5),

                Expanded(child: Text(vehicleModel)),
              ],
            ),

            const SizedBox(height: 10),

            Row(
              children: [
                const Icon(Icons.confirmation_number, color: Colors.green),

                const SizedBox(width: 8),

                const Text(
                  'Vehicle Number:',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),

                const SizedBox(width: 5),

                Expanded(child: Text(vehicleNumber)),
              ],
            ),

            const SizedBox(height: 10),

            Row(
              children: [
                const Icon(Icons.battery_full, color: Colors.green),

                const SizedBox(width: 8),

                const Text(
                  'Battery:',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),

                const SizedBox(width: 5),

                Text('$batteryCapacity kWh'),
              ],
            ),

            const SizedBox(height: 10),

            Row(
              children: [
                const Icon(Icons.access_time, color: Colors.green),

                const SizedBox(width: 8),

                const Text(
                  'Reserved At:',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),

                const SizedBox(width: 5),

                Expanded(child: Text(formattedDate)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ==========================================================
  // ADD VEHICLE FORM
  // ==========================================================

  Widget buildAddVehicleSection() {
    return Card(
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.add_circle_outline, color: Colors.green),

                SizedBox(width: 8),

                Text(
                  'Add Vehicle',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ],
            ),

            const SizedBox(height: 18),

            TextField(
              controller: vehicleNumberController,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: 'Vehicle Number',
                hintText: 'JH01AB1234',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.directions_car),
              ),
            ),

            const SizedBox(height: 14),

            TextField(
              controller: vehicleModelController,
              decoration: const InputDecoration(
                labelText: 'Vehicle Model',
                hintText: 'Tata Nexon EV',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.electric_car),
              ),
            ),

            const SizedBox(height: 14),

            TextField(
              controller: batteryCapacityController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'Battery Capacity (kWh)',
                hintText: '40.5',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.battery_full),
              ),
            ),

            const SizedBox(height: 16),

            if (vehicleMessage != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  vehicleMessage!,
                  style: TextStyle(
                    color: vehicleMessageIsError ? Colors.red : Colors.green,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),

            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton.icon(
                onPressed: isAddingVehicle ? null : addVehicle,
                icon: isAddingVehicle
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Icon(Icons.save),
                label: Text(
                  isAddingVehicle ? 'Registering...' : 'Register Vehicle',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ==========================================================
  // BLE SCAN
  // ==========================================================

  Future<void> startBleScan() async {
    if (isScanning) return;

    setState(() {
      isScanning = true;
      connectionStatus = 'Searching for KIIT EV Charging Station...';
    });

    try {
      await FlutterBluePlus.stopScan();

      scanSubscription?.cancel();

      scanSubscription = FlutterBluePlus.scanResults.listen((results) async {
        for (final result in results) {
          final device = result.device;

          final deviceName = device.platformName;

          final hasOurService = result.advertisementData.serviceUuids.any(
            (uuid) => uuid == serviceUuid,
          );

          final isOurDevice =
              hasOurService ||
              deviceName == 'KIIT EV Charging Station' ||
              deviceName == 'EV_CHARGING_STATION';

          if (isOurDevice) {
            await FlutterBluePlus.stopScan();

            connectedDevice = device;

            if (mounted) {
              setState(() {
                connectionStatus =
                    'KIIT EV Charging Station found. Connecting...';
              });
            }

            await connectToDevice(device);

            break;
          }
        }
      });

      await FlutterBluePlus.startScan(timeout: const Duration(seconds: 10));

      if (mounted && !isConnected) {
        setState(() {
          isScanning = false;
          connectionStatus = 'KIIT EV Charging Station not found';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          isScanning = false;
          connectionStatus = 'BLE error: $e';
        });
      }
    }
  }

  // ==========================================================
  // CONNECT TO ESP32
  // ==========================================================

  Future<void> connectToDevice(BluetoothDevice device) async {
    try {
      await device.connect(
        timeout: const Duration(seconds: 15),
        autoConnect: false,
        license: License.nonprofit,
      );

      if (mounted) {
        setState(() {
          isConnected = true;
          isScanning = false;
          connectionStatus = 'Connected to KIIT EV Charging Station';
        });
      }

      connectionSubscription = device.connectionState.listen((state) {
        if (state == BluetoothConnectionState.disconnected) {
          if (mounted) {
            setState(() {
              isConnected = false;
              connectionStatus = 'Disconnected from KIIT EV Charging Station';
            });
          }
        }
      });

      await discoverServices(device);
    } catch (e) {
      if (mounted) {
        setState(() {
          isConnected = false;
          isScanning = false;
          connectionStatus = 'Connection failed';
        });
      }
    }
  }

  // ==========================================================
  // DISCOVER SERVICES
  // ==========================================================

  Future<void> discoverServices(BluetoothDevice device) async {
    try {
      final services = await device.discoverServices();

      for (final service in services) {
        if (service.uuid == serviceUuid) {
          for (final char in service.characteristics) {
            if (char.uuid == characteristicUuid) {
              characteristic = char;

              await subscribeToCharacteristic(char);

              return;
            }
          }
        }
      }

      if (mounted) {
        setState(() {
          connectionStatus = 'EV Charging Station service not found';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          connectionStatus = 'Service discovery failed';
        });
      }
    }
  }

  // ==========================================================
  // CHARACTERISTIC
  // ==========================================================

  Future<void> subscribeToCharacteristic(BluetoothCharacteristic char) async {
    try {
      await char.setNotifyValue(true);

      characteristicSubscription = char.lastValueStream.listen((value) {
        final data = utf8.decode(value);

        updateSlotStates(data);
      });

      final initialValue = await char.read();

      if (initialValue.isNotEmpty) {
        final data = utf8.decode(initialValue);

        updateSlotStates(data);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          connectionStatus = 'Characteristic error';
        });
      }
    }
  }

  // ==========================================================
  // PARSE SLOT DATA
  // ==========================================================

  void updateSlotStates(String data) {
    final RegExp regex = RegExp(r'S1:(\d+),S2:(\d+),S3:(\d+),S4:(\d+)');

    final match = regex.firstMatch(data);

    if (match != null) {
      final slot1 = int.parse(match.group(1)!);

      final slot2 = int.parse(match.group(2)!);

      final slot3 = int.parse(match.group(3)!);

      final slot4 = int.parse(match.group(4)!);

      if (mounted) {
        setState(() {
          slot1State = slot1;
          slot2State = slot2;
          slot3State = slot3;
          slot4State = slot4;
        });
      }

      updateBackend(slot1, slot2, slot3, slot4);
    }
  }

  // ==========================================================
  // UPDATE BACKEND
  // ==========================================================

  Future<void> updateBackend(int slot1, int slot2, int slot3, int slot4) async {
    try {
      await http.patch(
        Uri.parse(backendUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'slot1Occupied': slot1 == 1,
          'slot2Occupied': slot2 == 1,
          'slot3Occupied': slot3 == 1,
          'slot4Occupied': slot4 == 1,
        }),
      );
    } catch (e) {
      // Keep BLE working even if backend
      // temporarily cannot be reached.
    }
  }

  // ==========================================================
  // DISPOSE
  // ==========================================================

  @override
  void dispose() {
    scanSubscription?.cancel();

    connectionSubscription?.cancel();

    characteristicSubscription?.cancel();

    backendTimer?.cancel();

    connectedDevice?.disconnect();

    vehicleNumberController.dispose();

    vehicleModelController.dispose();

    batteryCapacityController.dispose();

    super.dispose();
  }

  // ==========================================================
  // SLOT CARD
  // ==========================================================

  Widget buildSlotCard(String slotName, int state) {
    final bool occupied = state == 1;

    return Card(
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(
              occupied ? Icons.ev_station : Icons.ev_station_outlined,
              size: 45,
              color: occupied ? Colors.red : Colors.green,
            ),

            const SizedBox(height: 10),

            Text(
              slotName,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),

            const SizedBox(height: 8),

            Text(
              occupied ? 'Occupied' : 'Available',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: occupied ? Colors.red : Colors.green,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ==========================================================
  // HOME UI
  // ==========================================================

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('EV Charging Station'),
        actions: [
          IconButton(
            onPressed: widget.onLogout,
            icon: const Icon(Icons.logout),
            tooltip: 'Logout',
          ),
        ],
      ),

      body: RefreshIndicator(
        onRefresh: () async {
          await loadVehicles();

          await loadReservations();

          if (!isConnected) {
            await startBleScan();
          }
        },

        child: ListView(
          padding: const EdgeInsets.all(16),

          children: [
            // =================================================
            // USER INFORMATION
            // =================================================

            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),

                child: Row(
                  children: [
                    const CircleAvatar(radius: 25, child: Icon(Icons.person)),

                    const SizedBox(width: 15),

                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,

                        children: [
                          Text(
                            'Welcome, ${widget.user['name']}',
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),

                          const SizedBox(height: 4),

                          Text(
                            widget.user['email'] ?? '',
                            style: const TextStyle(color: Colors.grey),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 15),

            // =================================================
            // MY VEHICLE
            // =================================================
            const Text(
              'My Vehicle',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),

            const SizedBox(height: 10),

            if (isLoadingVehicles)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(20),
                  child: Center(child: CircularProgressIndicator()),
                ),
              )
            else if (vehicles.isEmpty)
              buildAddVehicleSection()
            else
              Column(
                children: [
                  ...vehicles.map(
                    (vehicle) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: buildVehicleCard(vehicle),
                    ),
                  ),

                  buildAddVehicleSection(),
                ],
              ),

            const SizedBox(height: 15),

            // =================================================
            // MY RESERVATIONS
            // =================================================
            const Text(
              'My Reservations',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),

            const SizedBox(height: 10),

            if (isLoadingReservations)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(20),
                  child: Center(child: CircularProgressIndicator()),
                ),
              )
            else if (reservationMessage != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    reservationMessage!,
                    style: TextStyle(
                      color: reservationMessageIsError
                          ? Colors.red
                          : Colors.green,
                    ),
                  ),
                ),
              )
            else if (reservations.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: const [
                      Icon(Icons.event_busy, size: 45, color: Colors.grey),

                      SizedBox(height: 10),

                      Text(
                        'No reservations yet.',
                        style: TextStyle(color: Colors.grey, fontSize: 16),
                      ),
                    ],
                  ),
                ),
              )
            else
              Column(
                children: [
                  ...reservations.map(
                    (reservation) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: buildReservationCard(reservation),
                    ),
                  ),
                ],
              ),

            const SizedBox(height: 15),

            // =================================================
            // CONNECTION STATUS
            // =================================================
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),

                child: Row(
                  children: [
                    Icon(
                      isConnected
                          ? Icons.bluetooth_connected
                          : Icons.bluetooth_disabled,

                      color: isConnected ? Colors.green : Colors.red,
                    ),

                    const SizedBox(width: 10),

                    Expanded(
                      child: Text(
                        connectionStatus,
                        style: const TextStyle(fontSize: 16),
                      ),
                    ),

                    if (!isConnected)
                      IconButton(
                        onPressed: startBleScan,
                        icon: const Icon(Icons.refresh),
                      ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 15),

            // =================================================
            // STATION INFO
            // =================================================
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16),

                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,

                  children: [
                    Text(
                      'STATION_001',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),

                    SizedBox(height: 6),

                    Text(
                      'KIIT EV Charging Station',
                      style: TextStyle(fontSize: 16, color: Colors.grey),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 15),

            // =================================================
            // SLOT SUMMARY
            // =================================================
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),

                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,

                  children: [
                    Column(
                      children: [
                        const Text(
                          'Available',
                          style: TextStyle(color: Colors.grey),
                        ),

                        const SizedBox(height: 5),

                        Text(
                          '$availableSlots',
                          style: const TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: Colors.green,
                          ),
                        ),
                      ],
                    ),

                    Column(
                      children: [
                        const Text(
                          'Occupied',
                          style: TextStyle(color: Colors.grey),
                        ),

                        const SizedBox(height: 5),

                        Text(
                          '$occupiedSlots',
                          style: const TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: Colors.red,
                          ),
                        ),
                      ],
                    ),

                    const Column(
                      children: [
                        Text('Total', style: TextStyle(color: Colors.grey)),

                        SizedBox(height: 5),

                        Text(
                          '4',
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 15),

            // =================================================
            // SLOTS
            // =================================================
            const Text(
              'Charging Slots',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),

            const SizedBox(height: 10),

            buildSlotCard('Slot 1', slot1State),

            buildSlotCard('Slot 2', slot2State),

            buildSlotCard('Slot 3', slot3State),

            buildSlotCard('Slot 4', slot4State),

            const SizedBox(height: 20),

            // =================================================
            // REFRESH / RESCAN
            // =================================================
            SizedBox(
              height: 50,

              child: ElevatedButton.icon(
                onPressed: isScanning ? null : startBleScan,

                icon: const Icon(Icons.bluetooth),

                label: Text(isScanning ? 'Scanning...' : 'Scan for Station'),
              ),
            ),

            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}
