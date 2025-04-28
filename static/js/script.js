// NYC Taxi Fare Estimator - main.js

let map;
let autocompletePickup;
let autocompleteDropoff;
let directionsService;
let directionsRenderer;

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 40.7128, lng: -74.0060 },
        zoom: 12,
        styles: [
            // base geometry
            { elementType: "geometry", stylers: [{ color: "#2E2E2E" }] },
            // hide default icons
            { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
            // labels
            { elementType: "labels.text.fill", stylers: [{ color: "#F8F9FA" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#2E2E2E" }] },
            // administrative boundaries
            {
              featureType: "administrative",
              elementType: "geometry.stroke",
              stylers: [{ color: "#757575" }, { weight: 1 }]
            },
            // parks in Central Green
            {
              featureType: "poi.park",
              elementType: "geometry.fill",
              stylers: [{ color: "#3C9D5B" }]
            },
            // hide business POIs
            { featureType: "poi.business", stylers: [{ visibility: "off" }] },
            // roads
            {
              featureType: "road.highway",
              elementType: "geometry.fill",
              stylers: [{ color: "#295E89" }, { weight: 1.5 }]
            },
            {
              featureType: "road.arterial",
              elementType: "geometry",
              stylers: [{ color: "#383838" }]
            },
            {
              featureType: "road.local",
              elementType: "geometry.stroke",
              stylers: [{ color: "#1F1F1F" }]
            },
            {
              featureType: "road",
              elementType: "labels.text.fill",
              stylers: [{ color: "#FFD60A" }]
            },
            // water in Hudson Blue
            {
              featureType: "water",
              elementType: "geometry.fill",
              stylers: [{ color: "#295E89" }]
            },
            {
              featureType: "water",
              elementType: "labels.text.fill",
              stylers: [{ color: "#F8F9FA" }]
            }
          ]
          
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        polylineOptions: {
            strokeColor: '#FFD60A',
            strokeWeight: 5
        }
    });

    autocompletePickup = new google.maps.places.Autocomplete(
        document.getElementById('pickup'),
        { componentRestrictions: { country: 'us' } }
    );

    autocompleteDropoff = new google.maps.places.Autocomplete(
        document.getElementById('dropoff'),
        { componentRestrictions: { country: 'us' } }
    );

    // Add listeners to update map when both fields are filled
    autocompletePickup.addListener('place_changed', updateRouteIfBothFilled);
    autocompleteDropoff.addListener('place_changed', updateRouteIfBothFilled);

    document.getElementById('calculate-btn').addEventListener('click', calculateFare);
    document.getElementById('download-pdf').addEventListener('click', downloadPDF);
    
    // Setup modal functionality
    setupModal();
}

function updateRouteIfBothFilled() {
    const pickup = document.getElementById('pickup').value;
    const dropoff = document.getElementById('dropoff').value;
    
    if (pickup && dropoff) {
        updateMap(pickup, dropoff);
    }
}

function showSpinner(show) {
    const spinner = document.getElementById('loading-spinner');
    spinner.style.display = show ? 'inline-block' : 'none';
}

function showError(message) {
    alert(message);
}

async function calculateFare() {
    const pickup = document.getElementById('pickup').value;
    const dropoff = document.getElementById('dropoff').value;
    const payment = document.getElementById('payment').value;

    if (!pickup || !dropoff) {
        alert('Please enter both pickup and dropoff locations.');
        return;
    }

    showSpinner(true);

    try {
        const response = await fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                pickup_address: pickup, 
                dropoff_address: dropoff, 
                payment_type: payment 
            })
        });

        const data = await response.json();

        if (!response.ok || !data || data.error) {
            alert(data.message || 'Prediction failed. Please try again.');
            showSpinner(false);
            return;
        }

        updateResults(data);
        updateMap(pickup, dropoff);
    } catch (error) {
        console.error('Error:', error);
        alert('Something went wrong! Please check your network or try again.');
    }

    showSpinner(false);
}

function updateResults(data) {

    
    // Format currency values with a helper function to handle NaN
    const formatCurrency = (value) => {
        if (value === null || value === undefined || isNaN(value)) {
            return '$0.00';
        }
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD', 
            minimumFractionDigits: 2 
        }).format(value);
    };

    // Update fare amounts - using the correct IDs from your HTML
    document.getElementById('fare-amount').textContent = formatCurrency(data.base_fare);
    document.getElementById('total-amount').textContent = formatCurrency(data.total_amount);
    document.getElementById('base-fare').textContent = formatCurrency(data.base_fare);
    document.getElementById('extra').textContent = formatCurrency(data.extra);
    document.getElementById('congestion').textContent = formatCurrency(data.congestion);
    document.getElementById('mta-tax').textContent = formatCurrency(data.mta);
    document.getElementById('improvement').textContent = formatCurrency(data.improvement);

    // Update trip details with safe access to nested properties
    if (data.details) {
        // Format distance with fallback
        const distance = data.details.distance_miles;
        document.getElementById('distance').textContent = 
            (distance !== null && distance !== undefined && !isNaN(distance)) 
                ? `${distance.toFixed(2)} miles` 
                : 'N/A';
        
        // Format duration with fallback
        const duration = data.details.duration_minutes;
        document.getElementById('duration').textContent = 
            (duration !== null && duration !== undefined && !isNaN(duration)) 
                ? `${Math.round(duration)} mins` 
                : 'N/A';
        
        // Format day of week with fallback
        const dayOfWeek = data.details.pickup_dayofweek;
        if (dayOfWeek !== null && dayOfWeek !== undefined && !isNaN(dayOfWeek)) {
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            document.getElementById('pickup-day').textContent = 
                (dayOfWeek >= 0 && dayOfWeek < days.length) ? days[dayOfWeek] : 'N/A';
        } else {
            document.getElementById('pickup-day').textContent = 'N/A';
        }
        
        // Format hour with fallback
        const hour = data.details.pickup_hour;
        if (hour !== null && hour !== undefined && !isNaN(hour)) {
            const hourFormatted = hour === 0 ? '12 AM' : 
                                hour === 12 ? '12 PM' : 
                                hour < 12 ? `${hour} AM` : 
                                `${hour - 12} PM`;
            document.getElementById('pickup-hour').textContent = hourFormatted;
        } else {
            document.getElementById('pickup-hour').textContent = 'N/A';
        }
        
        // Format date with fallback
        document.getElementById('pickup-date').textContent = data.details.pickup_date || 'N/A';
    }
    
    // Show results section
    document.getElementById('results').style.display = 'block';
}

function updateMap(pickup, dropoff) {
    directionsService.route({
        origin: pickup,
        destination: dropoff,
        travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
        } else {
            console.error('Directions request failed due to ' + status);
        }
    });
}

function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Get values from the DOM with correct IDs
    const pickup = document.getElementById('pickup').value;
    const dropoff = document.getElementById('dropoff').value;
    const fare = document.getElementById('fare-amount').textContent;
    const total = document.getElementById('total-amount').textContent;
    const distance = document.getElementById('distance').textContent;
    const duration = document.getElementById('duration').textContent;
    const pickupDay = document.getElementById('pickup-day').textContent;
    const pickupHour = document.getElementById('pickup-hour').textContent;
    const pickupDate = document.getElementById('pickup-date').textContent;

    // Add NYC Taxi branding
    doc.setFillColor(255, 214, 10); // #FFD60A - NYC Yellow
    doc.rect(0, 0, 210, 30, 'F');
    
    doc.setTextColor(46, 46, 46); // #2E2E2E - Asphalt Black
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('NYC Taxi Fare Estimate', 105, 20, { align: 'center' });


    // Add trip details section
    doc.setFillColor(248, 249, 250); // #F8F9FA - Pearl White
    doc.rect(10, 40, 190, 100, 'F');
    
    doc.setTextColor(46, 46, 46); // #2E2E2E - Asphalt Black
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Trip Details', 20, 55);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Pickup: ${pickup}`, 20, 70);
    doc.text(`Dropoff: ${dropoff}`, 20, 80);
    doc.text(`Distance: ${distance}`, 20, 90);
    doc.text(`Duration: ${duration}`, 20, 100);
    doc.text(`Date: ${pickupDate}`, 20, 110);
    doc.text(`Day: ${pickupDay}`, 20, 120);
    doc.text(`Time: ${pickupHour}`, 20, 130);

    // Add fare details section
    doc.setFillColor(248, 249, 250); // #F8F9FA - Pearl White
    doc.rect(10, 150, 190, 100, 'F');
    
    doc.setTextColor(46, 46, 46); // #2E2E2E - Asphalt Black
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Fare Details', 20, 165);

    // Create fare breakdown table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    const tableData = [
        ['Charge', 'Amount'],
        ['Base Fare', fare],
        ['Total Fare (incl. surcharges)', total]
    ];
    
    // Draw table
    let y = 180;
    const colWidth = [100, 50];
    const rowHeight = 10;
    
    // Draw header row
    doc.setFont('helvetica', 'bold');
    doc.text(tableData[0][0], 20, y);
    doc.text(tableData[0][1], 120, y);
    y += rowHeight;
    
    // Draw data rows
    doc.setFont('helvetica', 'normal');
    for (let i = 1; i < tableData.length; i++) {
        doc.text(tableData[i][0], 20, y);
        doc.text(tableData[i][1], 120, y);
        y += rowHeight;
    }

    // Add footer
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(46, 46, 46); // #2E2E2E - Asphalt Black
    doc.text('Built by Harsh Bajpai', 105, 280, { align: 'center' });
    doc.text('This is an estimate only. Actual fare may vary.', 105, 285, { align: 'center' });

    // Save PDF
    doc.save('nyc-taxi-fare-estimate.pdf');
}

function setupModal() {
    const modal = document.getElementById('about-modal');
    const aboutLink = document.getElementById('about-link');
    const closeBtn = document.getElementsByClassName('close')[0];
    
    // Open modal when About link is clicked
    if (aboutLink) {
        aboutLink.addEventListener('click', function(e) {
            e.preventDefault();
            modal.style.display = 'block';
        });
    }
    
    // Close modal when X is clicked
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
    }
    
    // Close modal when clicking outside of it
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}