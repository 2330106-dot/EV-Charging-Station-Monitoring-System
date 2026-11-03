import 'dart:convert';

import 'package:http/http.dart' as http;

import 'vehicle_model.dart';

class VehicleService {
  static const String baseUrl = 'http://10.5.98.186:5000';

  // ==========================================================
  // GET MY VEHICLES
  // ==========================================================

  static Future<List<Vehicle>> getMyVehicles(String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/vehicles/my'),
      headers: {'Authorization': 'Bearer $token'},
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);

      final List vehiclesJson = data['vehicles'];

      return vehiclesJson.map((vehicle) => Vehicle.fromJson(vehicle)).toList();
    }

    throw Exception('Failed to load vehicles: ${response.body}');
  }

  // ==========================================================
  // ADD VEHICLE
  // ==========================================================

  static Future<Vehicle> addVehicle({
    required String token,
    required String vehicleNumber,
    required String vehicleModel,
    required double batteryCapacity,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/vehicles'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'vehicleNumber': vehicleNumber,
        'vehicleModel': vehicleModel,
        'batteryCapacity': batteryCapacity,
      }),
    );

    if (response.statusCode == 201) {
      final data = jsonDecode(response.body);

      return Vehicle.fromJson(data['vehicle']);
    }

    throw Exception('Failed to add vehicle: ${response.body}');
  }
}
