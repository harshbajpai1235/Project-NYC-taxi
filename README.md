# 🗽 NYC Yellow Taxi Fare & Total Amount Prediction

A full-stach data science project **that predicts NYC Yellow Taxi rides fares** and **total trip amounts** using machine learning and hybrid rule-based logic. The application is deployed as a public website that takes trip details as input and provides real-time fare estimates.

## 🚀 Live Demo

Visit [NYC Yellow Taxi Fare Estimation](https://nyc-yellow-taxi-fare-prediction.onrender.com/) to get your fare estimate. You just need to input the pickup and drop-off location and payment types to get the estimation.

🔐 Powered by Flask, Google Maps API, Random Forest

## 📌 Project Goals

**1. Fare Prediction** <br> 
     Build a regression model that estimates fare amounts using trip characterstics like distance, time, and location.

**2. Revenue Optimization by Payment Method** <br>
     Explore how payment types (cash vs. card) impact total revenue and use insights to suggest profitable customer behavior nudges.


## 🧠 Key Features

- 📦 Predicts fare_amount using a trained Random Forest Regressor.
- 🧾 Calculates total_amount using hybrid rule-based logic (e.g., fixed extras, tolls, surcharges).
- 🌐 Integrates Google Maps API for pickup/dropoff autocomplete, route distance & duration.
- 🚕 Handles special cases like JFK flat-rate rides using conditional logic.
- 🎨 Custom frontend using HTML + CSS + JavaScript, connected to a Flask backend.
- ☁️ ML model hosted on Hugging Face Model Hub for efficient API usage.

## 📂 File Structure

```bash
project/
│
├── app.py                  # Flask backend server
├── fare_predictor.py       # Fare + total amount logic using ML & rule-based strategy
├── templates/
│   └── index.html          # Frontend UI with input form & result display
├── static/
│   ├── css/                #CSS styling file
│   └── js/                 # JS file
├── models/
│   └── rf_small_model.pkl   # trained model
├── .env                    # (not uploaded) stores API keys securely
├── requirements.txt       # Python dependencies
└── README.md
```

## 🧪 Model Training Summary

- Dataset: NYC Yellow Taxi Trip Records (Jan 2020)
- Sample Size : ~6.4 million records
- Features Used:<br> 
trip_distance, trip_duration, pickup_hour, pickup_dayofweek, pickup_month,<br>
RatecodeID, payment_type, PULocationID, DOLocaitonID
- Initial Model: Trained using RandomForestRegressor with: <br>
- n_estimators = 100 <br>
- max_depth = 20<br>
🔴 This full model was highly accurate but resulted in a 1.5 GB .pkl file, which was not practical for deployment on free platforms.<br>
- Final Deployed Model: To ensure fast loading and hosting compatibility (e.g., Render), a new model was trained with:<br>
- n_estimators = 30<br>
- max_depth = 12 <br>
✅ The resulting model size is just 3.8 MB while retaining high accuracy.<br>
- Model Hosting: The compressed model is hosted on Render.com

## 🔍 Analysis Highlights

- Peak fares and long-distance rides occur around 5AM (likely airport drop-offs)
- Card payments lead to slightly higher total revenue on average compared to cash.
- Strong linear correlation between trip distance and fare (except flat-rate airport fares).
- Flat-rate aiport fares (e.g., JFK) identified and handles via custom logic.
- More insights in the Jupyter Notebook files:<br>
                                        - HB_NYC_Fare_Prediction_Project.ipynb<br>
                                        - NYC_Taxi_Project_Part_II.ipynb<br>

## 🔐 API Key Security

Google maps API key is stored securely using a .env fiel (not uploaded to Github).

## ⚙️ Deployment Instructions (Local)

1. Clone this repo:
   ```bash
   git clone https://github.com/harshbajpai1235/nyc-taxi-fare-prediction.git
   cd nyc-taxi-fare-prediction
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Add your .env file with:
   ```bash
   GOOGLE_MAPS_API_KEY=your_key
   ```

4. Run Flask:
   ```bash
   python app.py
   ```

## 📈 Future Enhancements

- Add historical surge pricing based on date/time.
- Support trip tip prediction
- Deploy full-stack app via Docker on scalable cloud infrastructure
- Collect user feedback for fare accuracy & improve model iteratively.


## 🧑‍💻 Author

**Harsh Bajpai** <br>
Master's in Statistical Data Science<br>
[LinkedIn](www.linkedin.com/in/harsh-bajpai22) <br>
