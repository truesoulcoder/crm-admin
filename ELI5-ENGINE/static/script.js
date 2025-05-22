document.addEventListener('DOMContentLoaded', function () {
    // Connect to the Socket.IO server hosted by Flask
    // The URL should match where your Flask app is served.
    // If Flask is at http://127.0.0.1:5000, then SocketIO connects there by default.
    const socket = io(); 

    const startButton = document.getElementById('startCampaign'); // Corrected ID from HTML
    const marketRegionSelect = document.getElementById('marketRegionSelect');
    const subjectTemplateInput = document.getElementById('subjectTemplate');
    const bodyTemplateTextarea = document.getElementById('bodyTemplate');
    const monitoringLogDiv = document.getElementById('monitoringLog');

    async function fetchMarketRegions() {
        try {
            log('Fetching market regions...');
            const response = await fetch('/get_market_regions');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
            }
            const data = await response.json();
            if (data.error) {
                throw new Error(`Server error: ${data.error}`);
            }
            populateMarketRegionSelect(data.market_regions || []);
        } catch (error) {
            log(`Error fetching market regions: ${error}`, true);
            // Optionally disable campaign start if regions can't be loaded
            if (marketRegionSelect) {
                marketRegionSelect.innerHTML = '<option value="">Error loading regions</option>';
                marketRegionSelect.disabled = true;
            }
            if (startButton) startButton.disabled = true;
        }
    }

    function populateMarketRegionSelect(regions) {
        if (!marketRegionSelect) return;
        // Clear existing options (placeholder will be replaced)
        marketRegionSelect.innerHTML = ''; 

        if (regions.length === 0) {
            log('No market regions found or returned from backend.');
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No market regions available";
            marketRegionSelect.appendChild(option);
            marketRegionSelect.disabled = true;
            if (startButton) startButton.disabled = true; // Disable start if no regions
        } else {
            log(`Found ${regions.length} market regions. Populating dropdown.`);
            const placeholderOption = document.createElement('option');
            placeholderOption.value = "";
            placeholderOption.textContent = "-- Select a Market Region --";
            marketRegionSelect.appendChild(placeholderOption);

            regions.forEach(region => {
                const option = document.createElement('option');
                option.value = region;
                option.textContent = region;
                marketRegionSelect.appendChild(option);
            });
            marketRegionSelect.disabled = false;
        }
    }

    function log(message, isError = false) {
        const timestamp = new Date().toLocaleTimeString();
        const p = document.createElement('p');
        p.textContent = `[${timestamp}] ${message}`;
        if (isError) {
            p.style.color = 'red';
        }
        // Clear initial 'Log messages will appear here...' if it exists
        if (monitoringLogDiv.querySelector('p em')) {
            monitoringLogDiv.innerHTML = '';
        }
        monitoringLogDiv.appendChild(p);
        monitoringLogDiv.scrollTop = monitoringLogDiv.scrollHeight; // Auto-scroll
    }

    startButton.addEventListener('click', function () {
        const selectedMarketRegion = marketRegionSelect.value;
        const subjectTemplate = subjectTemplateInput.value;
        const bodyTemplate = bodyTemplateTextarea.value;

        if (!selectedMarketRegion) {
            log('Error: Please select a Market Region.', true);
            return;
        }
        if (!subjectTemplate.trim()) {
            log('Error: Email Subject Template cannot be empty.', true);
            return;
        }
        if (!bodyTemplate.trim()) {
            log('Error: Email Body Template cannot be empty.', true);
            return;
        }

        log('Starting campaign... Sending data to backend.');
        startButton.disabled = true;
        startButton.textContent = 'Campaign Running...';

        socket.emit('start_campaign', {
            market_region: selectedMarketRegion,
            subject_template: subjectTemplate,
            body_template: bodyTemplate
        });
    });

    socket.on('connect', function() {
        log('Connected to monitoring service.');
        fetchMarketRegions(); // Fetch market regions when connected
    });

    socket.on('disconnect', function() {
        log('Disconnected from backend server.', true);
        startButton.disabled = true; // Disable if connection lost
        startButton.textContent = 'Disconnected';
    });

    socket.on('log_message', function(msg) {
        log(msg.data);
    });

    socket.on('campaign_finished', function() {
        log('Campaign processing finished by backend.');
        startButton.disabled = false;
        startButton.textContent = 'Start Sending Campaign';
    });

    log('ELI5 Full-Stack Gmail Sender Initialized.');
});
