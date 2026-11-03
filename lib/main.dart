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

const String backendUrl = 'http://10.5.98.186:5000/api/stations/slots';

const String registerUrl = 'http://10.5.98.186:5000/api/auth/register';

const String loginUrl = 'http://10.5.98.186:5000/api/auth/login';

const String vehicleUrl = 'http://10.5.98.186:5000/api/vehicles';

const String myVehiclesUrl = 'http://10.5.98.186:5000/api/vehicles/my';

const String reservationsUrl = 'http://10.5.98.186:5000/api/reservations';
const String myReservationsUrl = '$reservationsUrl/my';
const String stationMongoId = '6a7c866d6d8829d4fcebbd20';
const String mlPredictionUrl = 'http://10.5.98.186:5000/api/ml/predict-my-wait';

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

      if (response.statusCode == 200) {
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
    } catch (e, stackTrace) {
      debugPrint('MAIN LOGIN ERROR: $e');
      debugPrintStack(stackTrace: stackTrace);

      if (mounted) {
        setState(() {
          errorMessage = 'Login failed: $e';
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
  // AI WAITING-TIME PREDICTION
  // ==========================================================

  bool isLoadingMLPrediction = false;

  Map<String, dynamic>? mlPrediction;

  String? mlPredictionError;

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

  bool isCheckingIn = false;

  bool isStartingCharging = false;

  bool isCompletingCharging = false;

  // NEW: Reservation creation
  bool isCreatingReservation = false;

  String? selectedVehicleId;

  int? selectedSlotNumber;
  String reservationType = 'immediate';

  DateTime? scheduledStartTime;

  DateTime? scheduledEndTime;

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
  // AI WAITING-TIME PREDICTION
  // ==========================================================

  Future<void> fetchMyWaitPrediction(String stationId) async {
    if (isLoadingMLPrediction) return;

    setState(() {
      isLoadingMLPrediction = true;
      mlPredictionError = null;
      mlPrediction = null;
    });

    try {
      final response = await http
          .post(
            Uri.parse(mlPredictionUrl),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${widget.token}',
            },
            body: jsonEncode({'stationId': stationId}),
          )
          .timeout(const Duration(seconds: 15));

      final dynamic decoded = jsonDecode(response.body);

      if (decoded is! Map<String, dynamic>) {
        throw const FormatException('Unexpected prediction response.');
      }

      final data = decoded;

      if (response.statusCode == 200) {
        if (mounted) {
          setState(() {
            mlPrediction = data;
            mlPredictionError = null;
          });
        }
      } else {
        debugPrint('ML STATUS: ${response.statusCode}');
        debugPrint('ML RESPONSE: ${response.body}');

        if (mounted) {
          setState(() {
            mlPredictionError =
                data['message']?.toString() ??
                'HTTP ${response.statusCode}: ${response.body}';
          });
        }
      }
    } catch (e) {
      debugPrint('ML PREDICTION ERROR: $e');
      if (mounted) {
        setState(() {
          mlPredictionError = 'Prediction error: $e';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          isLoadingMLPrediction = false;
        });
      }
    }
  }

  // ==========================================================
  // JOIN CHARGING QUEUE
  // ==========================================================

  bool isJoiningQueue = false;
  String? queueMessage;
  bool queueMessageIsError = false;

  Future<void> joinChargingQueue() async {
    if (isJoiningQueue) return;

    if (selectedVehicleId == null || selectedVehicleId!.isEmpty) {
      setState(() {
        queueMessage = 'Please select a vehicle before joining the queue.';
        queueMessageIsError = true;
      });
      return;
    }

    setState(() {
      isJoiningQueue = true;
      queueMessage = null;
      queueMessageIsError = false;
    });

    try {
      final response = await http
          .post(
            Uri.parse('$reservationsUrl/queue/join'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${widget.token}',
            },
            body: jsonEncode({
              'vehicleId': selectedVehicleId,
              'stationId': stationMongoId,
            }),
          )
          .timeout(const Duration(seconds: 15));

      final dynamic decoded = jsonDecode(response.body);

      if (decoded is! Map<String, dynamic>) {
        throw const FormatException('Unexpected queue response.');
      }

      final data = decoded;

      if (response.statusCode == 201 && data['success'] == true) {
        final position = data['queuePosition'];

        if (!mounted) return;

        setState(() {
          queueMessage = position == null
              ? 'Joined the charging queue successfully.'
              : 'Joined the queue at position #$position.';
          queueMessageIsError = false;
          selectedVehicleId = null;
        });

        await loadReservations();

        // Fetch the ML prediction only after successfully joining.
        await fetchMyWaitPrediction(stationMongoId);
      } else {
        if (!mounted) return;

        setState(() {
          queueMessage = data['message']?.toString() ?? 'Unable to join queue.';
          queueMessageIsError = true;
        });
      }
    } catch (e) {
      if (!mounted) return;

      setState(() {
        queueMessage =
            'Could not join the queue. Please check your connection.';
        queueMessageIsError = true;
      });
    } finally {
      if (mounted) {
        setState(() {
          isJoiningQueue = false;
        });
      }
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
  // CREATE RESERVATION
  // ==========================================================
  Future<DateTime?> pickScheduledDateTime({
    required DateTime initialDate,
    required DateTime firstDate,
  }) async {
    final date = await showDatePicker(
      context: context,
      initialDate: initialDate.isBefore(firstDate) ? firstDate : initialDate,
      firstDate: firstDate,
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );

    if (!mounted || date == null) return null;

    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initialDate),
    );

    if (!mounted || time == null) return null;

    return DateTime(date.year, date.month, date.day, time.hour, time.minute);
  }

  String formatScheduledDateTime(DateTime? value) {
    if (value == null) return 'Not selected';

    final local = value.toLocal();

    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';

    return '${local.day.toString().padLeft(2, '0')}/'
        '${local.month.toString().padLeft(2, '0')}/'
        '${local.year} $hour:$minute $period';
  }

  Future<void> createReservation() async {
    if (isCreatingReservation) return;

    if (selectedVehicleId == null || selectedVehicleId!.isEmpty) {
      setState(() {
        reservationMessage = 'Please select a vehicle.';
        reservationMessageIsError = true;
      });
      return;
    }

    if (selectedSlotNumber == null) {
      setState(() {
        reservationMessage = 'Please select a charging slot.';
        reservationMessageIsError = true;
      });
      return;
    }
    // VALIDATE SCHEDULED RESERVATION TIMES
    if (reservationType == 'scheduled') {
      final now = DateTime.now();

      if (scheduledStartTime == null || scheduledEndTime == null) {
        setState(() {
          reservationMessage =
              'Please select both scheduled start and end times.';
          reservationMessageIsError = true;
        });
        return;
      }

      if (!scheduledStartTime!.isAfter(now)) {
        setState(() {
          reservationMessage = 'Scheduled start time must be in the future.';
          reservationMessageIsError = true;
        });
        return;
      }

      if (!scheduledEndTime!.isAfter(scheduledStartTime!)) {
        setState(() {
          reservationMessage = 'End time must be after start time.';
          reservationMessageIsError = true;
        });
        return;
      }
    }

    // Check physical slot availability before sending request.
    final selectedSlotOccupied = selectedSlotNumber == 1
        ? slot1State == 1
        : selectedSlotNumber == 2
        ? slot2State == 1
        : selectedSlotNumber == 3
        ? slot3State == 1
        : slot4State == 1;

    if (reservationType == 'immediate' && selectedSlotOccupied) {
      setState(() {
        reservationMessage = 'Slot $selectedSlotNumber is currently occupied.';
        reservationMessageIsError = true;
      });
      return;
    }

    setState(() {
      isCreatingReservation = true;
      reservationMessage = null;
      reservationMessageIsError = false;
    });

    try {
      final response = await http.post(
        Uri.parse(reservationsUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
        body: jsonEncode({
          'vehicleId': selectedVehicleId,
          'stationId': stationMongoId,
          'slotNumber': selectedSlotNumber,
          if (reservationType == 'scheduled')
            'scheduledStartTime': scheduledStartTime!.toUtc().toIso8601String(),
          if (reservationType == 'scheduled')
            'scheduledEndTime': scheduledEndTime!.toUtc().toIso8601String(),
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 201 && data['success'] == true) {
        if (mounted) {
          setState(() {
            reservationMessage =
                'Slot $selectedSlotNumber reserved successfully.';
            reservationMessageIsError = false;

            selectedVehicleId = null;
            selectedSlotNumber = null;
            reservationType = 'immediate';
            scheduledStartTime = null;
            scheduledEndTime = null;
          });
        }

        await loadReservations();
      } else {
        if (mounted) {
          setState(() {
            reservationMessage =
                data['message'] ?? 'Could not reserve the slot.';
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
        isCreatingReservation = false;
      });
    }
  }

  // ==========================================================
  // CHECK-IN RESERVATION
  // ==========================================================

  Future<void> checkInReservation(String reservationId) async {
    if (isCheckingIn) return;

    setState(() {
      isCheckingIn = true;
      reservationMessage = null;
      reservationMessageIsError = false;
    });

    try {
      final response = await http.post(
        Uri.parse('$reservationsUrl/$reservationId/check-in'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        if (mounted) {
          setState(() {
            reservationMessage = 'Check-in successful. You are now checked in.';
            reservationMessageIsError = false;
          });
        }

        await loadReservations();
      } else {
        if (mounted) {
          setState(() {
            reservationMessage = data['message'] ?? 'Check-in failed.';
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
        isCheckingIn = false;
      });
    }
  }

  // ==========================================================
  // START CHARGING
  // ==========================================================

  Future<void> startChargingReservation(String reservationId) async {
    if (isStartingCharging) return;

    setState(() {
      isStartingCharging = true;
      reservationMessage = null;
      reservationMessageIsError = false;
    });

    try {
      final response = await http.post(
        Uri.parse('$reservationsUrl/$reservationId/start-charging'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        if (mounted) {
          setState(() {
            reservationMessage = 'Charging started successfully.';
            reservationMessageIsError = false;
          });
        }

        await loadReservations();
      } else {
        if (mounted) {
          setState(() {
            reservationMessage = data['message'] ?? 'Could not start charging.';
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
        isStartingCharging = false;
      });
    }
  }

  // ==========================================================
  // COMPLETE CHARGING
  // ==========================================================

  Future<void> completeChargingReservation(String reservationId) async {
    if (isCompletingCharging) return;

    setState(() {
      isCompletingCharging = true;
      reservationMessage = null;
      reservationMessageIsError = false;
    });

    try {
      final response = await http.post(
        Uri.parse('$reservationsUrl/$reservationId/complete-charging'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        if (mounted) {
          setState(() {
            reservationMessage = 'Charging completed successfully.';
            reservationMessageIsError = false;
          });
        }

        await loadReservations();
      } else {
        if (mounted) {
          setState(() {
            reservationMessage =
                data['message'] ?? 'Could not complete charging.';
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
        isCompletingCharging = false;
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
  // DATE FORMATTER
  // ==========================================================

  String formatDateTime(String value) {
    if (value.isEmpty || value == 'null') {
      return 'Unknown';
    }

    final parsed = DateTime.tryParse(value);

    if (parsed == null) {
      return 'Unknown';
    }

    final local = parsed.toLocal();

    return '${local.day}/'
        '${local.month}/'
        '${local.year} '
        '${local.hour}:'
        '${local.minute.toString().padLeft(2, '0')}';
  }

  // ==========================================================
  // RESERVATION CARD
  // ==========================================================

  Widget buildReservationCard(Map<String, dynamic> reservation) {
    final stationId = reservation['stationId']?.toString() ?? 'Unknown';

    final slotNumber = reservation['slotNumber']?.toString() ?? 'Unknown';

    final status = reservation['status']?.toString() ?? 'Unknown';
    // SCHEDULED RESERVATION DETAILS
    final bool isScheduled = reservation['isScheduled'] == true;

    final String scheduledStart =
        reservation['scheduledStartTime']?.toString() ?? '';

    final String scheduledEnd =
        reservation['scheduledEndTime']?.toString() ?? '';

    final DateTime? scheduledStartDate = DateTime.tryParse(scheduledStart)
        ?.toLocal();

    final DateTime? scheduledEndDate = DateTime.tryParse(scheduledEnd)
        ?.toLocal();

    final DateTime now = DateTime.now();

    final bool scheduledHasStarted =
        !isScheduled ||
        (scheduledStartDate != null && !now.isBefore(scheduledStartDate));

    final bool scheduledHasEnded =
        isScheduled &&
        scheduledEndDate != null &&
        !now.isBefore(scheduledEndDate);

    final reservedAt = reservation['reservedAt']?.toString() ?? '';

    final checkInTime = reservation['checkInTime']?.toString() ?? '';

    final chargingStartTime =
        reservation['chargingStartTime']?.toString() ?? '';

    final chargingEndTime = reservation['chargingEndTime']?.toString() ?? '';

    final vehicle = reservation['vehicle'];

    String vehicleModel = 'Unknown';

    String vehicleNumber = 'Unknown';

    String batteryCapacity = 'Unknown';

    if (vehicle is Map) {
      vehicleModel = vehicle['vehicleModel']?.toString() ?? 'Unknown';

      vehicleNumber = vehicle['vehicleNumber']?.toString() ?? 'Unknown';

      batteryCapacity = vehicle['batteryCapacity']?.toString() ?? 'Unknown';
    }

    final formattedDate = formatDateTime(reservedAt);

    final formattedCheckInDate = formatDateTime(checkInTime);

    final formattedChargingStartDate = formatDateTime(chargingStartTime);

    final formattedChargingEndDate = formatDateTime(chargingEndTime);

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

    final bool canCheckIn =
        status == 'RESERVED' && scheduledHasStarted && !scheduledHasEnded;

    final bool canStartCharging = status == 'CHECKED_IN';

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
                    color: statusColor.withValues(alpha: 0.12),
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

            // VEHICLE
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

            // VEHICLE NUMBER
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

            // BATTERY
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

            // RESERVED AT
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
            // SCHEDULED RESERVATION TIMES
            if (isScheduled) ...[
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.calendar_month, color: Colors.indigo),
                  const SizedBox(width: 8),
                  const Text(
                    'Scheduled Start:',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(width: 5),
                  Expanded(
                    child: Text(
                      scheduledStartDate == null
                          ? 'Unavailable'
                          : formatDateTime(
                              scheduledStartDate.toIso8601String(),
                            ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.event, color: Colors.indigo),
                  const SizedBox(width: 8),
                  const Text(
                    'Scheduled End:',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(width: 5),
                  Expanded(
                    child: Text(
                      scheduledEndDate == null
                          ? 'Unavailable'
                          : formatDateTime(scheduledEndDate.toIso8601String()),
                    ),
                  ),
                ],
              ),
              if (status == 'RESERVED' &&
                  !scheduledHasStarted &&
                  scheduledStartDate != null) ...[
                const SizedBox(height: 10),
                Text(
                  'Check-in opens at '
                  '${formatDateTime(scheduledStartDate.toIso8601String())}.',
                  style: const TextStyle(
                    color: Colors.indigo,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
              if (status == 'RESERVED' && scheduledHasEnded) ...[
                const SizedBox(height: 10),
                const Text(
                  'The scheduled reservation window has ended.',
                  style: TextStyle(
                    color: Colors.red,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],

            // CHECK-IN TIME
            if (status == 'CHECKED_IN' ||
                status == 'CHARGING' ||
                status == 'COMPLETED') ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(Icons.login, color: Colors.deepPurple),
                  const SizedBox(width: 8),
                  const Text(
                    'Checked In:',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(width: 5),
                  Expanded(child: Text(formattedCheckInDate)),
                ],
              ),
            ],

            // CHARGING START TIME
            if (status == 'CHARGING' || status == 'COMPLETED') ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(Icons.battery_charging_full, color: Colors.green),
                  const SizedBox(width: 8),
                  const Text(
                    'Charging Started:',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(width: 5),
                  Expanded(child: Text(formattedChargingStartDate)),
                ],
              ),
            ],

            // CHARGING END TIME
            if (status == 'COMPLETED') ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(Icons.event_available, color: Colors.teal),
                  const SizedBox(width: 8),
                  const Text(
                    'Charging Completed:',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(width: 5),
                  Expanded(child: Text(formattedChargingEndDate)),
                ],
              ),
            ],

            // CHECK-IN BUTTON
            if (canCheckIn) ...[
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: isCheckingIn
                      ? null
                      : () {
                          final reservationId = reservation['_id']?.toString();

                          if (reservationId != null &&
                              reservationId.isNotEmpty) {
                            checkInReservation(reservationId);
                          }
                        },
                  icon: isCheckingIn
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Icon(Icons.login),
                  label: Text(
                    isCheckingIn ? 'Checking In...' : 'CHECK IN',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],

            // START CHARGING
            if (canStartCharging) ...[
              const SizedBox(height: 18),

              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.green.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: Colors.green.withValues(alpha: 0.25),
                  ),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.check_circle, color: Colors.green),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'You are checked in. You can now start charging.',
                        style: TextStyle(
                          color: Colors.green,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 12),

              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: isStartingCharging
                      ? null
                      : () {
                          final reservationId = reservation['_id']?.toString();

                          if (reservationId != null &&
                              reservationId.isNotEmpty) {
                            startChargingReservation(reservationId);
                          }
                        },
                  icon: isStartingCharging
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Icon(Icons.battery_charging_full),
                  label: Text(
                    isStartingCharging
                        ? 'Starting Charging...'
                        : 'START CHARGING',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],

            // CHARGING STATUS
            if (status == 'CHARGING') ...[
              const SizedBox(height: 18),

              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.green.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Row(
                  children: [
                    Icon(
                      Icons.battery_charging_full,
                      color: Colors.green,
                      size: 28,
                    ),
                    SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Charging in progress',
                            style: TextStyle(
                              color: Colors.green,
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          SizedBox(height: 3),
                          Text(
                            'Your vehicle is currently charging.',
                            style: TextStyle(color: Colors.green),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 12),

              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.teal,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: isCompletingCharging
                      ? null
                      : () {
                          final reservationId = reservation['_id']?.toString();

                          if (reservationId != null &&
                              reservationId.isNotEmpty) {
                            completeChargingReservation(reservationId);
                          }
                        },
                  icon: isCompletingCharging
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Icon(Icons.check_circle),
                  label: Text(
                    isCompletingCharging
                        ? 'Completing Charging...'
                        : 'COMPLETE CHARGING',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],

            // COMPLETED STATUS
            if (status == 'COMPLETED') ...[
              const SizedBox(height: 18),

              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.teal.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.check_circle, color: Colors.teal, size: 28),
                    SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Charging completed successfully.',
                            style: TextStyle(
                              color: Colors.teal,
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Your charging session has ended.',
                            style: TextStyle(color: Colors.teal),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
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
  // RESERVE SLOT SECTION
  // ==========================================================

  Widget buildReserveSlotSection() {
    final availableSlotNumbers = <int>[];

    if (reservationType == 'scheduled') {
      // Scheduled reservations can select any slot.
      // The backend checks availability for the requested time.
      availableSlotNumbers.addAll([1, 2, 3, 4]);
    } else {
      // Immediate reservations can select only physically vacant slots.
      if (slot1State == 0) availableSlotNumbers.add(1);
      if (slot2State == 0) availableSlotNumbers.add(2);
      if (slot3State == 0) availableSlotNumbers.add(3);
      if (slot4State == 0) availableSlotNumbers.add(4);
    }

    return Card(
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.event_available, color: Colors.green),
                SizedBox(width: 8),
                Text(
                  'Reserve a Charging Slot',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ],
            ),

            const SizedBox(height: 8),

            const Text(
              'Select your vehicle and an available charging slot.',
              style: TextStyle(color: Colors.grey),
            ),

            const SizedBox(height: 18),
            // RESERVATION TYPE
            DropdownButtonFormField<String>(
              initialValue: reservationType,
              decoration: const InputDecoration(
                labelText: 'Reservation Type',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.schedule),
              ),
              items: const [
                DropdownMenuItem(
                  value: 'immediate',
                  child: Text('Immediate Reservation'),
                ),
                DropdownMenuItem(
                  value: 'scheduled',
                  child: Text('Scheduled Reservation'),
                ),
              ],
              onChanged: isCreatingReservation
                  ? null
                  : (value) {
                      if (value == null) return;

                      setState(() {
                        reservationType = value;
                        selectedSlotNumber = null;
                        scheduledStartTime = null;
                        scheduledEndTime = null;
                      });
                    },
            ),

            const SizedBox(height: 16),

            // VEHICLE SELECTION
            DropdownButtonFormField<String>(
              initialValue: selectedVehicleId,
              decoration: const InputDecoration(
                labelText: 'Select Vehicle',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.electric_car),
              ),
              items: vehicles
                  .map((vehicle) {
                    final vehicleId = vehicle['_id']?.toString();

                    final vehicleModel =
                        vehicle['vehicleModel']?.toString() ?? 'Unknown';

                    final vehicleNumber =
                        vehicle['vehicleNumber']?.toString() ?? 'Unknown';

                    if (vehicleId == null || vehicleId.isEmpty) {
                      return null;
                    }

                    return DropdownMenuItem<String>(
                      value: vehicleId,
                      child: Text(
                        '$vehicleModel • $vehicleNumber',
                        overflow: TextOverflow.ellipsis,
                      ),
                    );
                  })
                  .whereType<DropdownMenuItem<String>>()
                  .toList(),
              onChanged: isCreatingReservation
                  ? null
                  : (value) {
                      setState(() {
                        selectedVehicleId = value;
                      });
                    },
            ),

            const SizedBox(height: 16),

            // SLOT SELECTION
            DropdownButtonFormField<int>(
              initialValue: selectedSlotNumber,
              decoration: const InputDecoration(
                labelText: 'Select Charging Slot',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.ev_station),
              ),
              items: availableSlotNumbers
                  .map(
                    (slotNumber) => DropdownMenuItem<int>(
                      value: slotNumber,
                      child: Text('Slot $slotNumber • Available'),
                    ),
                  )
                  .toList(),
              onChanged: isCreatingReservation || availableSlotNumbers.isEmpty
                  ? null
                  : (value) {
                      setState(() {
                        selectedSlotNumber = value;
                      });
                    },
            ),

            const SizedBox(height: 12),
            // SCHEDULED DATE AND TIME
            if (reservationType == 'scheduled') ...[
              const SizedBox(height: 8),

              OutlinedButton.icon(
                onPressed: isCreatingReservation
                    ? null
                    : () async {
                        final now = DateTime.now();
                        final initial =
                            scheduledStartTime ??
                            now.add(const Duration(hours: 1));

                        final picked = await pickScheduledDateTime(
                          initialDate: initial,
                          firstDate: DateTime(now.year, now.month, now.day),
                        );

                        if (picked != null && mounted) {
                          setState(() {
                            scheduledStartTime = picked;
                            if (scheduledEndTime != null &&
                                !scheduledEndTime!.isAfter(picked)) {
                              scheduledEndTime = null;
                            }
                          });
                        }
                      },
                icon: const Icon(Icons.calendar_month),
                label: Text(
                  'Start: ${formatScheduledDateTime(scheduledStartTime)}',
                ),
              ),

              const SizedBox(height: 8),

              OutlinedButton.icon(
                onPressed: isCreatingReservation
                    ? null
                    : () async {
                        final start = scheduledStartTime;
                        if (start == null) {
                          setState(() {
                            reservationMessage =
                                'Please select a start time first.';
                            reservationMessageIsError = true;
                          });
                          return;
                        }

                        final picked = await pickScheduledDateTime(
                          initialDate:
                              scheduledEndTime ??
                              start.add(const Duration(hours: 1)),
                          firstDate: DateTime(
                            start.year,
                            start.month,
                            start.day,
                          ),
                        );

                        if (picked != null && mounted) {
                          setState(() {
                            scheduledEndTime = picked;
                          });
                        }
                      },
                icon: const Icon(Icons.event),
                label: Text(
                  'End: ${formatScheduledDateTime(scheduledEndTime)}',
                ),
              ),

              const SizedBox(height: 12),
            ],

            // STATION
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                children: [
                  Icon(Icons.location_on, color: Colors.green),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'STATION_001 • KIIT EV Charging Station',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            if (availableSlotNumbers.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.warning, color: Colors.red),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'All physical charging slots are currently occupied.',
                        style: TextStyle(
                          color: Colors.red,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            // JOIN QUEUE WHEN ALL SLOTS ARE OCCUPIED
            if (availableSlotNumbers.isEmpty) ...[
              const SizedBox(height: 12),

              DropdownButtonFormField<String>(
                initialValue: selectedVehicleId,
                decoration: const InputDecoration(
                  labelText: 'Select Vehicle for Queue',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.electric_car),
                ),
                items: vehicles
                    .map((vehicle) {
                      final id = vehicle['_id']?.toString();

                      if (id == null || id.isEmpty) return null;

                      final model =
                          vehicle['vehicleModel']?.toString() ?? 'Unknown';
                      final number =
                          vehicle['vehicleNumber']?.toString() ?? 'Unknown';

                      return DropdownMenuItem<String>(
                        value: id,
                        child: Text('$model • $number'),
                      );
                    })
                    .whereType<DropdownMenuItem<String>>()
                    .toList(),
                onChanged: isJoiningQueue
                    ? null
                    : (value) {
                        setState(() {
                          selectedVehicleId = value;
                        });
                      },
              ),

              const SizedBox(height: 12),

              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: isJoiningQueue || vehicles.isEmpty
                      ? null
                      : joinChargingQueue,
                  icon: isJoiningQueue
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Icon(Icons.queue),
                  label: Text(
                    isJoiningQueue ? 'Joining Queue...' : 'JOIN CHARGING QUEUE',
                  ),
                ),
              ),

              if (queueMessage != null) ...[
                const SizedBox(height: 10),
                Text(
                  queueMessage!,
                  style: TextStyle(
                    color: queueMessageIsError ? Colors.red : Colors.green,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],

            const SizedBox(height: 16),

            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                onPressed:
                    isCreatingReservation ||
                        vehicles.isEmpty ||
                        (reservationType == 'immediate' &&
                            availableSlotNumbers.isEmpty)
                    ? null
                    : createReservation,
                icon: isCreatingReservation
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Icon(Icons.event_available),
                label: Text(
                  isCreatingReservation ? 'Reserving...' : 'RESERVE SLOT',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
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
            // RESERVE SLOT
            // =================================================
            const Text(
              'Book Charging',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),

            const SizedBox(height: 10),

            if (vehicles.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: const Text(
                    'Add at least one vehicle before making a reservation.',
                    style: TextStyle(color: Colors.grey),
                  ),
                ),
              )
            else
              buildReserveSlotSection(),

            const SizedBox(height: 15),

            // =================================================
            // MY RESERVATIONS
            // =================================================
            const Text(
              'My Reservations',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),

            const SizedBox(height: 10),

            if (reservationMessage != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    reservationMessage!,
                    style: TextStyle(
                      color: reservationMessageIsError
                          ? Colors.red
                          : Colors.green,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),

            if (isLoadingReservations)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(20),
                  child: Center(child: CircularProgressIndicator()),
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
            // ==========================================================
            // AI WAITING-TIME PREDICTION
            // ==========================================================

            // Show AI prediction for STATION_001[
            const SizedBox(height: 18),

            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.indigo.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: Colors.indigo.withValues(alpha: 0.25),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.psychology, color: Colors.indigo, size: 28),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'AI Waiting-Time Prediction',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 8),

                  const Text(
                    'Estimate your queue waiting time using the '
                    'Random Forest machine-learning model.',
                    style: TextStyle(color: Colors.black54),
                  ),

                  const SizedBox(height: 14),

                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: isLoadingMLPrediction
                          ? null
                          : () => fetchMyWaitPrediction('STATION_001'),
                      icon: isLoadingMLPrediction
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.schedule),
                      label: Text(
                        isLoadingMLPrediction
                            ? 'Calculating prediction...'
                            : 'Predict My Waiting Time',
                      ),
                    ),
                  ),

                  if (mlPredictionError != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      mlPredictionError!,
                      style: const TextStyle(
                        color: Colors.red,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],

                  if (mlPrediction != null) ...[
                    const SizedBox(height: 14),
                    const Divider(),
                    const SizedBox(height: 8),

                    Row(
                      children: [
                        const Icon(
                          Icons.format_list_numbered,
                          color: Colors.indigo,
                        ),
                        const SizedBox(width: 8),
                        const Expanded(child: Text('Queue position')),
                        Text(
                          '#${mlPrediction!['queuePosition'] ?? 'N/A'}',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),

                    const SizedBox(height: 10),

                    Row(
                      children: [
                        const Icon(Icons.ev_station, color: Colors.indigo),
                        const SizedBox(width: 8),
                        const Expanded(child: Text('Active charging sessions')),
                        Text(
                          '${mlPrediction!['activeChargingSessions'] ?? 'N/A'}',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),

                    const SizedBox(height: 10),

                    Row(
                      children: [
                        const Icon(Icons.timer_outlined, color: Colors.indigo),
                        const SizedBox(width: 8),
                        const Expanded(child: Text('Estimated waiting time')),
                        Text(
                          mlPrediction!['estimatedWaitMinutes'] == null
                              ? 'N/A'
                              : '${mlPrediction!['estimatedWaitMinutes']} min',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.indigo,
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 12),

                    const Text(
                      'Experimental estimate based on synthetic training data. '
                      'It has not been validated against real-world waiting times.',
                      style: TextStyle(fontSize: 12, color: Colors.black54),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
