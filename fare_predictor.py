import os
import gdown
import joblib
import pandas as pd 


# Define model URL (replace YOUR_FILE_ID with your actual Google Drive file ID)
model_url = "https://drive.google.com/uc?id=1wiktW0s0lQZZbMlEYY6FzxwVIxNtR0CI"
model_path = 'rf_full_model.pkl'

# Check if model file exists, if not, download it
if not os.path.exists(model_path):
    print("Downloading model from Google Drive...")
    gdown.download(model_url, model_path, quiet=False)

# Loading the pre-trained model
rf_model = joblib.load(model_path)
# Defining preprocessing pipeline
def preprocess_input(df):
    # Selecting required columns
    selected_columns = [
        'trip_distance', 'trip_duration', 'pickup_hour', 'pickup_dayofweek', 
        'pickup_month', 'is_weekend', 'RatecodeID', 'payment_type',
        'PULocationID', 'DOLocationID'
    ]
    return df[selected_columns]

# Defining fare prediction function
def predict_fare(input_df):
    # Converting categorical columns to string type (important for onehotencoder)
    cat_cols = ['RatecodeID', 'payment_type', 'PULocationID', 'DOLocationID']
    for col in cat_cols:
        input_df[col] = input_df[col].astype(str)

    # Applying JFK logic
    jfk_mask = input_df['RatecodeID'] == '2.0'
    result = pd.Series(index=input_df.index, dtype=float)

    # Predicting for non-JFK rides
    non_jfk_df = input_df[~jfk_mask]
    if not non_jfk_df.empty:
        processed = preprocess_input(non_jfk_df)
        result[~jfk_mask] = rf_model.predict(processed)

    # Applying flat rate for JFK
    result[jfk_mask] = 52.0

    return result

# Rule-based component functions
def estimate_extra(row):
    hr = row['pickup_hour']
    dow = row['pickup_dayofweek']

    if (20 <= hr <= 23) or (0 <= hr < 8):   # 8 PM to 8 AM
        return 0.5
    elif dow < 5 and 16 <= hr <= 20:        # Weekday rush hour
        return 1.0
    elif dow >= 5 and 18 <= hr <= 21:       # Weekend evenings
        return 2.5
    elif dow in [4, 5] and 22 <= hr <= 23:  # Late-night Friday/Saturday
        return 3.0
    else:
        return 0.0

def estimate_congestion_surcharge():
    return 2.5  # Flat based 

def estimate_tolls_amount():
    return 0.0  # Assumed 0 for all predictions

def estimate_mta_tax():
    return 0.5  # Fixed fees

def estimate_improvement_surcharge():
    return 0.3  # Fixed fees

# Total Amount Prediction Function
def predict_total_amount(input_df):
    # Check if this is a JFK flat rate ride
    if any(input_df['RatecodeID'] == 2.0):
        # Create a Series with the same index as input_df
        return pd.Series([52.0], index=input_df.index)
    
    # For non-JFK rides, use the model
    base_fare = predict_fare(input_df)
    extras = input_df.apply(estimate_extra, axis=1)
    congestion = estimate_congestion_surcharge()
    tolls = estimate_tolls_amount()
    mta = estimate_mta_tax()
    improvement = estimate_improvement_surcharge()
    
    # Compute final total
    total = base_fare + extras + congestion + tolls + mta + improvement
    return total.round(2)
