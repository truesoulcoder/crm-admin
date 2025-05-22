# ELI5 Full-Stack Gmail Sender

This application provides a simple web interface to send personalized emails using multiple Gmail accounts from your GSuite domain, impersonated via a Google Service Account with Domain-Wide Delegation. It uses a Python Flask backend to securely manage the sending process.

## Core Idea

A frontend (HTML/JS/CSS) allows you to configure and start an email campaign. A backend (Python/Flask) handles the secure interaction with the Gmail API, including sender impersonation and paced sending.

1.  **Frontend:** Input leads, define templates, start/monitor campaign.
2.  **Backend:** Securely uses Google Service Account, manages sender rotation, personalizes emails, sends via Gmail API, provides logs to frontend.

## Setup

### 1. Python Environment & Libraries

It's highly recommended to use a Python virtual environment:

```bash
# Navigate to the ELI5-ENGINE directory
cd path/to/your/ELI5-ENGINE

python -m venv .venv
# On Windows
.venv\Scripts\activate
# On macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Google Cloud Project & Service Account (Same as Python Script version)

This setup is identical to the one required for the earlier Python script that used a service account. If you've done it already, you can reuse the `service_account_key.json`.

**Steps (if not done already):**

1.  **Create/Select a Google Cloud Project:** [Google Cloud Console](https://console.cloud.google.com/).
2.  **Enable the Gmail API:** In your project, go to "APIs & Services" > "Library", search for "Gmail API" and enable it.
3.  **Create a Service Account:**
    *   Go to "IAM & Admin" > "Service Accounts".
    *   Click "Create Service Account" (e.g., "eli5-backend-sender").
    *   Click "Done".
4.  **Create a Service Account Key:**
    *   Find your service account, click Actions (three dots) > "Manage keys".
    *   "Add Key" > "Create new key" > Choose "JSON" > "Create".
    *   A JSON file will download. **Rename this file to `service_account_key.json` and place it directly inside the `ELI5-ENGINE` folder.** This file is critical and must be kept secure.
5.  **Configure Domain-Wide Delegation (DWD) in GSuite Admin Console:**
    *   Go to your [GSuite Admin Console](https://admin.google.com/).
    *   Navigate to "Security" > "Access and data control" > "API Controls".
    *   Under "Domain-wide Delegation", click "Manage Domain-wide Delegation".
    *   Click "Add New".
    *   **Client ID:** Open your `service_account_key.json` file. Find the `client_id` value and paste it here.
    *   **OAuth Scopes:** Enter `https://www.googleapis.com/auth/gmail.send`
    *   Click "Authorize".

### 3. Prepare Your Leads CSV

*   Create a CSV file (e.g., `leads.csv` or use `leads_example.csv`). Place it in the `ELI5-ENGINE` folder.
*   Ensure it has columns like `contact_email` and any fields for personalization (e.g., `contact_name`, `property_address`).
*   Update `LEADS_FILE_PATH` in `app.py` if your filename is different.

### 4. Configure Senders in `app.py`

*   Open `app.py` in a text editor.
*   Find the `SENDER_ACCOUNTS` list.
*   Update it with the Gmail addresses (from your GSuite domain) you want to use for sending.

## Running the Application

1.  Ensure all setup steps are complete (virtual environment activated, `service_account_key.json` in place, `requirements.txt` installed).
2.  Open your terminal, navigate to the `ELI5-ENGINE` directory.
3.  Run the Flask backend server:
    ```bash
    flask run
    # Or: python app.py
    ```
4.  The terminal will show output similar to:
    `* Running on http://127.0.0.1:5000/ (Press CTRL+C to quit)`
5.  Open your web browser and go to `http://127.0.0.1:5000/`.

## Using the Web App

1.  The web page will load.
2.  **Leads Data:** Paste your CSV data into the "Leads CSV Data" textarea.
3.  **Templates:** Define your "Email Subject Template" and "Email Body Template" using `{header_name}` placeholders.
4.  **Start Sending:** Click the "Start Sending Campaign" button.
5.  **Monitoring:** Progress, successes, and errors will be logged in the "Monitoring Log" window. The log updates in real-time.

## Customization (in `app.py` primarily)

*   `SENDER_ACCOUNTS`: List of Gmail accounts to impersonate.
*   `LEADS_FILE_PATH`: Path to your leads CSV.
*   `EMAIL_SUBJECT_TEMPLATE`, `EMAIL_BODY_TEMPLATE`: Default templates (can be overridden in UI).
*   `TIME_BETWEEN_EMAILS_SECONDS`, `EMAILS_PER_SENDER_BATCH`: Pacing controls.
