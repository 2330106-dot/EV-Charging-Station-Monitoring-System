class Vehicle {
  final String id;
  final String vehicleNumber;
  final String vehicleModel;
  final double batteryCapacity;

  Vehicle({
    required this.id,
    required this.vehicleNumber,
    required this.vehicleModel,
    required this.batteryCapacity,
  });

  factory Vehicle.fromJson(Map<String, dynamic> json) {
    return Vehicle(
      id: json['_id'].toString(),
      vehicleNumber: json['vehicleNumber'].toString(),
      vehicleModel: json['vehicleModel'].toString(),
      batteryCapacity: (json['batteryCapacity'] as num).toDouble(),
    );
  }
}
