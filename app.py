# Final Fully Fixed app.py

from flask import Flask, render_template, request, jsonify
import os
import googlemaps
import pandas as pd
import numpy as np
from datetime import datetime
from dotenv import load_dotenv
from zone_id_mapping import zone_id_mapping
from fare_predictor import predict_fare, estimate_extra, estimate_congestion_surcharge, estimate_tolls_amount, estimate_mta_tax, estimate_improvement_surcharge

# Load environment variables
load_dotenv()

app = Flask(__name__)

gmaps = googlemaps.Client(key=os.getenv("GOOGLE_MAPS_API_BACKEND_KEY"))

# Taxi Zone Setup
zone_name_to_id = {name: id for name, id in zone_id_mapping.items()}
taxi_zones_df = pd.read_csv('taxi_zones9.csv')
zone_centroids = {int(row['LocationID']): (row['Latitude'], row['Longitude']) for _, row in taxi_zones_df.iterrows()}
borough_zones = {'Manhattan': [], 'Brooklyn': [], 'Queens': [], 'Bronx': [], 'Staten Island': [], 'EWR': []}
for _, row in taxi_zones_df.iterrows():
    if row['borough'] in borough_zones:
        borough_zones[row['borough']].append(int(row['LocationID']))

@app.route("/")
def home():
    google_maps_api_key = os.getenv("GOOGLE_MAPS_API_FRONTEND_KEY")
    return render_template("index.html", google_maps_api_key=google_maps_api_key)

def haversine_distance(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a))
    return 6371 * c

def find_nearest_zone(lat, lng, zones=None):
    if zones is None:
        zones = zone_centroids
    else:
        zones = {zone_id: zone_centroids[zone_id] for zone_id in zones if zone_id in zone_centroids}
    min_distance = float('inf')
    nearest_zone_id = 161
    for zone_id, centroid in zones.items():
        try:
            distance = haversine_distance(lat, lng, centroid[0], centroid[1])
            if distance < min_distance:
                min_distance = distance
                nearest_zone_id = zone_id
        except Exception:
            continue
    return nearest_zone_id

def get_location_id(address):
    try:
        address_lower = address.lower()
        if "jfk" in address_lower or "john f kennedy" in address_lower:
            return 132
        if "laguardia" in address_lower or "la guardia" in address_lower:
            return 138
        if "newark" in address_lower and "airport" in address_lower:
            return 1
        geocode_result = gmaps.geocode(address)
        if not geocode_result:
            return 161
        location = geocode_result[0]['geometry']['location']
        lat, lng = location['lat'], location['lng']
        nyc_bounds = {"min_lat": 40.4774, "max_lat": 40.9176, "min_lng": -74.2591, "max_lng": -73.7004}
        if not (nyc_bounds["min_lat"] <= lat <= nyc_bounds["max_lat"] and nyc_bounds["min_lng"] <= lng <= nyc_bounds["max_lng"]):
            return None
        borough = None
        for component in geocode_result[0]['address_components']:
            if 'political' in component['types'] and 'sublocality_level_1' in component['types']:
                borough = component['long_name']
                break
            if 'administrative_area_level_2' in component['types'] and 'political' in component['types']:
                admin_area = component['long_name']
                for b in borough_zones.keys():
                    if b in admin_area:
                        borough = b
                        break
        if borough and borough in borough_zones:
            return find_nearest_zone(lat, lng, borough_zones[borough])
        return find_nearest_zone(lat, lng)
    except Exception:
        return 161
    

def is_jfk_flat_rate(pu_id, do_id):
    jfk_id = 132
    manhattan_ids = borough_zones['Manhattan']
    return (pu_id == jfk_id and do_id in manhattan_ids) or (do_id == jfk_id and pu_id in manhattan_ids)

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        pickup = data.get("pickup_address")
        dropoff = data.get("dropoff_address")
        payment_type = data.get("payment_type", "Credit Card")

        payment_type_map = {"Credit Card": "1.0", "Cash": "2.0"}
        payment_type = payment_type_map.get(payment_type, "1.0")

        pu_location_id = get_location_id(pickup)
        do_location_id = get_location_id(dropoff)

        if pu_location_id is None or do_location_id is None:
            return jsonify({"error": True, "message": "Currently, only NYC areas are supported."}), 400

        directions = gmaps.directions(pickup, dropoff, mode="driving")
        if not directions:
            return jsonify({"error": True, "message": "Could not find a driving route between these locations."}), 400

        leg = directions[0]["legs"][0]
        trip_distance = leg["distance"]["value"] / 1609.34
        trip_duration = leg["duration"]["value"] / 60

        now = datetime.now()
        pickup_hour = now.hour
        pickup_dayofweek = now.weekday()
        pickup_month = now.month
        is_weekend = 1 if pickup_dayofweek >= 5 else 0

        rate_code_id = 2.0 if is_jfk_flat_rate(pu_location_id, do_location_id) else 1.0

        input_df = pd.DataFrame([{
            "trip_distance": trip_distance,
            "trip_duration": trip_duration,
            "pickup_hour": pickup_hour,
            "pickup_dayofweek": pickup_dayofweek,
            "pickup_month": pickup_month,
            "is_weekend": is_weekend,
            "RatecodeID": rate_code_id,
            "payment_type": payment_type,
            "PULocationID": pu_location_id,
            "DOLocationID": do_location_id
        }])

        try:
            if rate_code_id == 2.0:
                base_fare = 52.0
                extras = 0.0
                congestion = 0.0
                tolls = 0.0
                mta_tax = 0.0
                improvement = 0.0
                total_amount = 52.0
            else:
                base_fare = float(predict_fare(input_df).values[0])
                extras = float(input_df.apply(estimate_extra, axis=1).values[0])
                congestion = float(estimate_congestion_surcharge())
                tolls = float(estimate_tolls_amount())
                mta_tax = float(estimate_mta_tax())
                improvement = float(estimate_improvement_surcharge())
                total_amount = base_fare + extras + congestion + tolls + mta_tax + improvement
        except Exception:
            base_fare = extras = congestion = tolls = mta_tax = improvement = total_amount = 0.0

        
    # build the response payload
        payload = {
            "total_amount": round(total_amount, 2),
            "base_fare":    round(base_fare,    2),
            "extra":        round(extras,       2),
            "congestion":   round(congestion,   2),
            "tolls":        round(tolls,        2),
            "mta":          round(mta_tax,      2),
            "improvement":  round(improvement,  2),
            "details": {
                "distance_miles":   round(trip_distance, 2),
                "duration_minutes": round(trip_duration, 2),
                "pickup_zone_id":   pu_location_id,
                "dropoff_zone_id":  do_location_id,
                "pickup_dayofweek": pickup_dayofweek,
                "pickup_hour":      pickup_hour,
                "pickup_date":      now.strftime("%Y-%m-%d"),
                "rate_code":        (
                    "JFK Flat Rate"
                    if rate_code_id == 2.0
                    else "Standard Rate"
                )
            }
        }

        # --- DEBUGGING LINE ---
        print("DEBUG /predict →", payload)
        # alternatively: app.logger.debug("DEBUG /predict → %s", payload)

        return jsonify(payload)


    except Exception as e:
        app.logger.exception("Unexpected /predict error")
        return jsonify({
            "error": True,
            "message": "Unexpected error occurred.",
            "details": str(e)
        }), 500

if __name__ == "__main__":
    app.run(debug=True)
