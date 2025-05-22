import os
from dotenv import load_dotenv
import json
import random
from datetime import datetime, timezone
from typing import Optional, Dict, Any

load_dotenv() # Load environment variables from .env file

import pandas as pd
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.mime.image import MIMEImage
from supabase import create_client, Client as SupabaseClient
import re
import csv
import random
import threading
import queue
import traceback

import io
from xhtml2pdf import pisa
from pypdf import PdfWriter, PdfReader
from jinja2 import Environment, FileSystemLoader
from datetime import datetime, timedelta

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# --- Configuration - PLEASE UPDATE THESE --- 
# Ensure service_account_key.json is in the ELI5-ENGINE directory
EMAIL_TEMPLATE_FILE = os.path.join(os.path.dirname(__file__), 'templates', 'email_body_with_subject.html') # For optional subject/body override
SENDER_CSV_FILE = os.path.join(os.path.dirname(__file__), 'csv', 'senders.csv')
LETTER_OF_INTENT_HTML_TEMPLATE_FILE = os.path.join(os.path.dirname(__file__), 'templates', 'letter_of_intent_text.html')
BLANK_LETTERHEAD_PDF_FILE = os.path.join(os.path.dirname(__file__), 'templates', 'blank-letterhead.pdf')
TEMP_PDF_DIR = os.path.join(os.path.dirname(__file__), 'temp_pdfs')

# Setup Jinja2 environment
TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), 'templates')
JINJA_ENV = Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=True)

# Supabase Configuration - Using values from your .env file
SUPABASE_URL = os.environ.get("SUPABASE_URL")
# Directly use the Service Role Key for all backend operations.
# Your .env file provides SUPABASE_SERVICE_ROLE_KEY.
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Fallback to anon key ONLY if service role key is explicitly missing from .env (should not happen with your setup)
if not SUPABASE_KEY:
    print("CRITICAL: SUPABASE_SERVICE_ROLE_KEY not found in .env. Attempting to use SUPABASE_KEY (anon key) instead. RLS policies may apply.")
    # If you have a log_to_frontend function, you might want to log this there too.
    # log_to_frontend("CRITICAL: SUPABASE_SERVICE_ROLE_KEY not found. Using anon key.")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: SupabaseClient = None # Global Supabase client instance

SENDER_ACCOUNTS = [] # Loaded from csv, list of dicts: [{'sender_name': '...', 'sender_email': '...'}]

# Forward declaration for socketio, will be initialized after app
socketio = None

# Function to load sender accounts from CSV
def load_sender_accounts():
    global SENDER_ACCOUNTS
    SENDER_ACCOUNTS = [] # Reset before loading
    try:
        if os.path.exists(SENDER_CSV_FILE):
            try:
                # Try with utf-8-sig first to handle potential BOM, and skip initial spaces
                df = pd.read_csv(SENDER_CSV_FILE, skipinitialspace=True, encoding='utf-8-sig')
            except Exception as read_err:
                log_to_frontend(f"Pandas read_csv failed for {SENDER_CSV_FILE}: {read_err}")
                return # Exit if we can't even read the file
            
            # Normalize column headers: convert to lower case and strip whitespace
            df.columns = [col.lower().strip() for col in df.columns]
            
            # Check for the required columns (now in lower case, matching CSV order: sender_name, then sender_email)
            if 'sender_name' in df.columns and 'sender_email' in df.columns:
                senders_df_filtered = df[['sender_name', 'sender_email']].copy()
                senders_df_filtered.dropna(subset=['sender_name', 'sender_email'], inplace=True)
                
                SENDER_ACCOUNTS = senders_df_filtered.rename(columns={'sender_name': 'name', 'sender_email': 'email'}).to_dict('records')
                log_to_frontend(f"Successfully loaded {len(SENDER_ACCOUNTS)} sender accounts with names from {SENDER_CSV_FILE}.")
                if not SENDER_ACCOUNTS:
                    log_to_frontend("Warning: No valid sender accounts (with email and name) found after processing CSV.")
            else:
                log_to_frontend(f"Error: 'sender_email' and/or 'sender_name' column not found in {SENDER_CSV_FILE}. Please ensure CSV has these exact column headers.")
        else:
            log_to_frontend(f"Error: Sender CSV file not found at {SENDER_CSV_FILE}")
    except Exception as e:
        log_to_frontend(f"Error loading sender accounts: {e}")
        import traceback
        log_to_frontend(traceback.format_exc())
    
    if not SENDER_ACCOUNTS:
        log_to_frontend("Warning: No sender accounts loaded. Email sending will not be possible. Check CSV content and path.")

# Sender accounts will be loaded after app and socketio initialization


# New Campaign Settings & Shared State for Concurrent Sending
MAX_CAMPAIGN_EMAILS_PER_DAY = 1000
MAX_SENDER_EMAILS_PER_DAY = 100
MIN_SEND_INTERVAL_SECONDS = 4 * 60  # 4 minutes
MAX_SEND_INTERVAL_SECONDS = 5 * 60  # 5 minutes

# Shared state (must be managed carefully, reset at campaign start)
leads_contacts_queue = queue.Queue()
campaign_stats_lock = threading.Lock() # Protects campaign_sent_count_overall and sender_daily_send_counts
campaign_stop_event = threading.Event()

# These will be reset at the start of each campaign by process_campaign_data
campaign_sent_count_overall = 0 
sender_daily_send_counts = {}

app = Flask(__name__)
CORS(app)  # Enable CORS for all origins and routes
app.config['SECRET_KEY'] = 'your_very_secret_key_here!change_me'
app.config['TEMPLATES_AUTO_RELOAD'] = True
socketio = SocketIO(app, cors_allowed_origins="*") # Initialize socketio here

# Initialize Supabase client early, but after basic app setup
# It's better to do this before routes or operations that might need it if app starts.
# However, ensure any functions it calls don't rely on uninitialized parts.

# Sender accounts will be loaded within the if __name__ == '__main__' block
# after all initializations are complete.

# --- Helper Functions (defined early for use by initializers) ---
def log_to_frontend(message):
    print(f"LOG: {message}") # Log to server console
    if socketio:
        socketio.emit('log_message', {'data': message})
        socketio.sleep(0.01) # Allow message to be sent
    else:
        print(f"SocketIO not initialized, cannot emit: {message}")

def is_valid_email(email):
    if not email:
        return False
    # Basic regex for email validation (consider a more robust library for production)
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"; # Ensure string is properly terminated
    return re.match(pattern, email) is not None

def format_currency(value):
    """Formats a float value into a currency string e.g., $1,234.56."""
    if value is None:
        return "$0.00"
    try:
        return "${:,.2f}".format(float(value))
    except (ValueError, TypeError):
        log_to_frontend(f"Warning: Could not format currency for value: {value}")
        return "$0.00"

def parse_currency(value):
    """Converts a string currency value to float, removing $ and commas."""
    if value is None:
        return 0.0
    try:
        return float(str(value).replace('$', '').replace(',', '').strip())
    except ValueError:
        log_to_frontend(f"Warning: Could not parse currency value: {value}")
        return 0.0

# --- End Helper Functions ---

def init_supabase_client():
    global supabase
    if not SUPABASE_URL or not SUPABASE_KEY:
        log_to_frontend("Critical Error: Supabase not configured on server with actual credentials. Please update them in .env file.")
        return False
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        log_to_frontend("Supabase client initialized successfully.")
        return True
    except Exception as e:
        print(f"Error initializing Supabase client: {e}")
        log_to_frontend(f"Error initializing Supabase client: {e}")
        return False

# REVISED/NEW LOGGING FUNCTIONS FOR eli5_email_log
def log_initial_email_attempt_to_db(lead_data, contact_name, contact_email, sender_email, sender_name_val, subject, body_preview, campaign_id_val=None, campaign_run_id_val=None):
    """
    Logs the initial attempt to process/email a contact to the eli5_email_log table.
    Returns the ID of the newly created log entry, or None if logging fails.
    """
    global supabase
    if not supabase:
        log_to_frontend("Supabase client not available for initial logging.")
        if not init_supabase_client():
            log_to_frontend("Failed to re-initialize Supabase client for initial logging. Log entry not created.")
            return None

    # Prepare data for eli5_email_log table
    log_entry_data = {
        "original_lead_id": lead_data.get("id"), # 'id' from normalized_leads, referenced as PK by eli5_email_log.original_lead_id
        "contact_name": contact_name,
        "contact_email": contact_email,
        
        # Snapshot of lead data
        "baths": lead_data.get("baths"),
        "beds": lead_data.get("beds"),
        "year_built": lead_data.get("year_built"),
        "square_footage": lead_data.get("square_footage"),
        "property_address": lead_data.get("property_address"),
        "property_city": lead_data.get("property_city"),
        "property_state": lead_data.get("property_state"),
        "property_postal_code": lead_data.get("property_postal_code"),
        "property_type": lead_data.get("property_type"),
        "assessed_total": lead_data.get("assessed_total"),
        "mls_curr_status": lead_data.get("mls_curr_status"),
        "mls_curr_days_on_market": lead_data.get("mls_curr_days_on_market"),
        "market_region": lead_data.get("market_region"),
        "normalized_lead_converted_status": lead_data.get("converted"),

        # Email sending details for this attempt
        "sender_name": sender_name_val,
        "sender_email_used": sender_email,
        "email_subject_sent": subject,
        "email_body_preview_sent": body_preview,
        "email_status": "PENDING_SEND", # Initial status
        "email_error_message": None,
        "email_sent_at": None,
        
        "campaign_id": campaign_id_val,
        "campaign_run_id": campaign_run_id_val,
        
        "converted": False, # This log entry's conversion status, defaults to False
    }

    try:
        response = supabase.table("eli5_email_log").insert(log_entry_data).execute()
        
        if response.data and len(response.data) > 0:
            new_log_id = response.data[0].get('id')
            return new_log_id
        elif hasattr(response, 'error') and response.error:
            log_to_frontend(f"Error creating initial log entry for {contact_email}: {response.error.message} - Data: {log_entry_data}")
            return None
        else:
            log_to_frontend(f"Unknown error or no data returned when creating initial log for {contact_email}. Response: {response}")
            return None
            
    except Exception as e:
        log_to_frontend(f"Exception while creating initial log entry for {contact_email}: {e} - Data: {log_entry_data}")
        import traceback
        log_to_frontend(traceback.format_exc())
        return None

def update_email_log_status_in_db(log_id, status, sent_at=None, error_message=None, is_converted_status=None):
    """
    Updates the status of an existing email log entry in eli5_email_log.
    """
    global supabase
    if not supabase:
        log_to_frontend(f"Supabase client not available for updating log ID {log_id}.")
        if not init_supabase_client():
            log_to_frontend(f"Failed to re-initialize Supabase client for updating log ID {log_id}. Update lost.")
            return False

    update_data = {
        "email_status": status,
        "email_sent_at": sent_at,
        "email_error_message": error_message
    }
    if is_converted_status is not None:
        update_data["converted"] = is_converted_status

    # Remove keys with None values, except for email_error_message and email_sent_at which can be explicitly set to None (or NULL in DB)
    update_data = {k: v for k, v in update_data.items() if v is not None or k == "email_error_message" or k == "email_sent_at"}

    if not update_data: # If nothing to update
        log_to_frontend(f"No actual data changes to update for log ID {log_id}.")
        return True 

    try:
        response = supabase.table("eli5_email_log").update(update_data).eq("id", log_id).execute()

        if hasattr(response, 'data') and response.data:
            return True
        elif hasattr(response, 'error') and response.error:
            log_to_frontend(f"Error updating log entry ID {log_id}: {response.error.message} - Update Data: {update_data}")
            return False
        elif not response.data: 
            log_to_frontend(f"No data returned when updating log ID {log_id}. It might not exist or no changes made. Status: {status}")
            return False 
        return True 
            
    except Exception as e:
        log_to_frontend(f"Exception while updating log entry ID {log_id}: {e} - Update Data: {update_data}")
        import traceback
        log_to_frontend(traceback.format_exc())
        return False

def generate_loi_pdf(personalization_data, lead_id, contact_email):
    """Generates a personalized Letter of Intent PDF and returns its file path."""
    global supabase, JINJA_ENV, LETTER_OF_INTENT_HTML_TEMPLATE_FILE, TEMP_PDF_DIR # Use global JINJA_ENV and template file path
    if not supabase:
        log_to_frontend("generate_loi_pdf: Supabase client not initialized.")
        return None

    try:
        # Load HTML template for the LOI using the global JINJA_ENV
        # LETTER_OF_INTENT_HTML_TEMPLATE_FILE is now a global full path
        template_filename = os.path.basename(LETTER_OF_INTENT_HTML_TEMPLATE_FILE)
        template = JINJA_ENV.get_template(template_filename)
        # Prepare data for personalization - make a copy
        pdf_data = personalization_data.copy()

        # Ensure current_date is formatted and present
        if 'current_date' not in pdf_data or not pdf_data['current_date']:
            pdf_data['current_date'] = datetime.now().strftime('%B %d, %Y')
        
        # Ensure all other expected keys have at least a default empty string if not present.
        # This helps prevent errors if the template tries to access a missing key,
        # though Jinja2 is generally more forgiving (e.g., treats missing as undefined).
        # The 'contact_name' is used in the Jinja2 expression in the template.
        expected_keys_for_defaults = [
            'property_address', 'property_city', 'property_state', 'property_zip_code',
            'contact_name', 
            'offer_price', 'emd_amount', 'closing_date', 'title_company',
            'sender_name', 'sender_title', 'company_name'
        ]
        for key in expected_keys_for_defaults:
            if key not in pdf_data:
                pdf_data[key] = '' 
            elif pdf_data[key] is None: # Handle explicit None values too
                pdf_data[key] = ''
        
        # Load and render the HTML template using Jinja2 (JINJA_ENV is global)
        template = JINJA_ENV.get_template(template_filename)
        personalized_html = template.render(pdf_data) # Pass the prepared data

        # Create a unique filename for the temporary LOI
        property_address_raw = str(pdf_data.get('property_address', 'Unknown_Address')) # Ensure string
        safe_property_address = re.sub(r'[^a-zA-Z0-9_.-]', '_', property_address_raw.replace(' ', '_'))
        safe_property_address = safe_property_address[:50]
        
        output_filename = f"LETTER_OF_INTENT_{safe_property_address}.pdf"
        temp_loi_path = os.path.join(TEMP_PDF_DIR, output_filename)

        # 1. Convert personalized HTML to a PDF (content_pdf_stream)
        content_pdf_stream = io.BytesIO()
        pisa_status = pisa.CreatePDF(io.StringIO(personalized_html), dest=content_pdf_stream)
        if pisa_status.err:
            log_to_frontend(f"Error generating PDF content from HTML: {pisa_status.err}")
            return None
        content_pdf_stream.seek(0)

        # 2. Merge content PDF onto blank letterhead
        output_pdf_writer = PdfWriter()
        letterhead_reader = PdfReader(blank_letterhead_path)
        content_reader = PdfReader(content_pdf_stream)

        if letterhead_reader.pages and content_reader.pages:
            letterhead_page = letterhead_reader.pages[0]
            content_page = content_reader.pages[0]
            
            letterhead_page.merge_page(content_page)
            output_pdf_writer.add_page(letterhead_page)
        else:
            log_to_frontend("Error: Letterhead or content PDF is empty.")
            return None

        with open(temp_loi_path, 'wb') as f_out:
            output_pdf_writer.write(f_out)
        
        log_to_frontend(f"Successfully generated LOI PDF: {temp_loi_path}")
        return temp_loi_path

    except Exception as e:
        log_to_frontend(f"Error generating LOI PDF for Lead ID {lead_id}, Contact {contact_email}: {e}")
        # import traceback # Keep commented out unless actively debugging
        # log_to_frontend(traceback.format_exc()) 
        return None

def load_email_template_from_file(file_path):
    subject = None
    body_html = None
    try:
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                body_html = f.read()
            subject_match = re.search(r"<!--\s*SUBJECT:\s*(.*?)\s*-->", body_html, re.IGNORECASE)
            if subject_match:
                subject = subject_match.group(1).strip()
            if not body_html: return None, None
            return subject, body_html
    except Exception as e:
        log_to_frontend(f"Error loading email template file {file_path}: {e}")
    return subject, body_html

def create_mime_message(sender_email, to_email, subject, body_html, attachment_path=None, sender_name=None):
    msg = MIMEMultipart('related')
    msg['to'] = to_email
    if sender_name: msg['from'] = f'"{sender_name}" <{sender_email}>'
    else: msg['from'] = sender_email
    msg['subject'] = subject
    msg_alternative = MIMEMultipart('alternative')
    msg.attach(msg_alternative)
    msg_text = MIMEText(body_html, 'html')
    msg_alternative.attach(msg_text)
    logo_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'images', 'truesoulpartnersllc.png')
    if os.path.exists(logo_path):
        try:
            with open(logo_path, 'rb') as img_file:
                msg_image = MIMEImage(img_file.read())
                msg_image.add_header('Content-ID', '<company_logo>')
                msg_image.add_header('Content-Disposition', 'inline', filename='truesoulpartnersllc.png')
                msg.attach(msg_image)
        except Exception as e: log_to_frontend(f"Error embedding company logo: {e}")
    else:
        log_to_frontend(f"Company logo image not found at path: {logo_path}")
    if attachment_path and os.path.exists(attachment_path):
        try:
            with open(attachment_path, 'rb') as f: part = MIMEApplication(f.read(), Name=os.path.basename(attachment_path))
            part['Content-Disposition'] = f'attachment; filename="{os.path.basename(attachment_path)}"'
            msg.attach(part)
        except Exception as e: log_to_frontend(f"Error attaching PDF {attachment_path}: {e}")
    return {'raw': base64.urlsafe_b64encode(msg.as_bytes()).decode()}

def get_gmail_service(user_email_to_impersonate):
    try:
        google_service_account_key_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_KEY")
        if not google_service_account_key_json:
            log_to_frontend("ERROR: GOOGLE_SERVICE_ACCOUNT_KEY environment variable not found.")
            return None
        
        try:
            service_account_info = json.loads(google_service_account_key_json)
        except json.JSONDecodeError as e:
            log_to_frontend(f"ERROR: Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY JSON: {e}")
            return None

        if 'private_key' in service_account_info:
            service_account_info['private_key'] = service_account_info['private_key'].replace('\\n', '\n')
        else:
            log_to_frontend("ERROR: 'private_key' not found in GOOGLE_SERVICE_ACCOUNT_KEY JSON.")
            return None

        creds = Credentials.from_service_account_info(
            service_account_info,
            scopes=['https://www.googleapis.com/auth/gmail.send'],
            subject=user_email_to_impersonate
        )
        service = build('gmail', 'v1', credentials=creds)
        log_to_frontend(f"Successfully initialized Gmail service for {user_email_to_impersonate} using environment variable.")
        return service
    except Exception as e:
        log_to_frontend(f"Error building Gmail service for {user_email_to_impersonate}: {e}")
        import traceback
        log_to_frontend(traceback.format_exc())
        return None

def send_gmail_message(service, user_id, message_body):
    try:
        message = service.users().messages().send(userId=user_id, body=message_body).execute()
        log_to_frontend(f"Message Id: {message['id']} sent successfully via {user_id}.")
        return True
    except Exception as e:
        log_to_frontend(f"Error sending email via {user_id}: {e}")
        # Ensure to return False or raise the exception if the caller expects to handle it
        return False

def process_campaign_leads(market_region: str,
                           sender_email_to_impersonate: str,
                           sender_name_to_use: str,
                           campaign_id: Optional[str] = None,
                           campaign_run_id: Optional[str] = None,
                           limit_per_run: int = 10) -> Dict[str, int]:
    global supabase, JINJA_ENV, EMAIL_TEMPLATE_FILE, LETTER_OF_INTENT_HTML_TEMPLATE_FILE, TEMP_PDF_DIR
    results = {'attempted': 0, 'succeeded': 0, 'failed': 0, 'skipped': 0}

    if not supabase:
        log_to_frontend("Error: Supabase client not initialized for campaign processing.")
        results['failed'] = limit_per_run
        return results

    if not all([EMAIL_TEMPLATE_FILE, LETTER_OF_INTENT_HTML_TEMPLATE_FILE, TEMP_PDF_DIR]):
        log_to_frontend("Error: Essential template/PDF directory paths are not configured.")
        results['failed'] = limit_per_run
        return results

    log_to_frontend(f"Starting campaign processing for market: {market_region}, sender: {sender_email_to_impersonate}, limit: {limit_per_run}")

    try:  # Outer try for the whole campaign batch
        query_fields = '''
            id,
            normalized_lead_id,
            contact_name,
            contact_email,
            property_address,
            property_city,
            property_state,
            property_postal_code,
            property_type,
            baths,
            beds,
            year_built,
            square_footage,
            wholesale_value,
            assessed_total,
            market_region
        '''
        
        query = supabase.table('useful_leads').select(query_fields) \
            .eq('market_region', market_region) \
            .is_('email_sent', None) \
            .neq('property_type', 'Vacant Land') \
            .not_.is_('contact_email', None) \
            .order('id', desc=False) \
            .limit(limit_per_run)

        response = query.execute()

        if hasattr(response, 'error') and response.error:
            log_to_frontend(f"Supabase error fetching campaign leads: {response.error.message}")
            results['failed'] = limit_per_run
            return results

        if not response.data:
            log_to_frontend(f"No eligible leads found for market '{market_region}' with sender '{sender_email_to_impersonate}'.")
            return results

        leads_to_process = response.data
        log_to_frontend(f"Fetched {len(leads_to_process)} leads for processing.")

        for lead_data_dict in leads_to_process:
            results['attempted'] += 1
            
            contact_name_from_ul = lead_data_dict.get('contact_name', "Valued Contact")
            contact_to_email = lead_data_dict.get('contact_email')
            # 'id' from useful_leads is the PK for useful_leads table itself
            useful_lead_id_to_update = lead_data_dict.get('id') 

            current_lead_details_for_log_and_template = {
                "id": lead_data_dict.get('normalized_lead_id'), # This is original_lead_id for the log
                "contact_name_1": contact_name_from_ul, # Use contact_name from useful_leads
                "contact_email_1": contact_to_email,
                "property_address": lead_data_dict.get('property_address'),
                "property_city": lead_data_dict.get('property_city'),
                "property_state": lead_data_dict.get('property_state'),
                "property_postal_code": lead_data_dict.get('property_postal_code'),
                "property_type": lead_data_dict.get('property_type'),
                "baths": lead_data_dict.get('baths'),
                "beds": lead_data_dict.get('beds'),
                "year_built": lead_data_dict.get('year_built'),
                "square_footage": lead_data_dict.get('square_footage'),
                "wholesale_value": lead_data_dict.get('wholesale_value'),
                "assessed_total": lead_data_dict.get('assessed_total'),
                "market_region": lead_data_dict.get('market_region'), # Use market_region from lead data
                "mls_curr_status": None, # Placeholder, add if available/needed
                "mls_curr_days_on_market": None, # Placeholder
                "normalized_lead_converted_status": None # Placeholder
            }

            if not is_valid_email(contact_to_email):
                log_to_frontend(f"Skipping useful_lead_id {useful_lead_id_to_update}: Invalid contact email '{contact_to_email}'.")
                results['skipped'] += 1
                continue

            email_log_id = None
            pdf_attachment_path = None
            email_sent_successfully = False
            error_message_for_log = None

            try:  # Inner try for individual lead processing
                email_subject_template, email_body_html_template = load_email_template_from_file(EMAIL_TEMPLATE_FILE)
                if not email_body_html_template:
                    raise ValueError(f"Failed to load email template from {EMAIL_TEMPLATE_FILE}")
                
                final_email_subject = email_subject_template if email_subject_template else "Regarding Your Property"

                email_log_id = log_initial_email_attempt_to_db(
                    lead_data=current_lead_details_for_log_and_template,
                    contact_name=contact_name_from_ul,
                    contact_email=contact_to_email,
                    sender_email=sender_email_to_impersonate,
                    sender_name_val=sender_name_to_use,
                    subject=final_email_subject,
                    body_preview=email_body_html_template[:255],
                    campaign_id_val=campaign_id,
                    campaign_run_id_val=campaign_run_id
                )
                if not email_log_id:
                    raise Exception("Failed to log initial email attempt to DB.")

                personalization_data_email = {
                    **current_lead_details_for_log_and_template,
                    "contact_name": contact_name_from_ul, # Ensure this is used in email template
                    "sender_name": sender_name_to_use
                }
                personalization_data_pdf = {
                    **current_lead_details_for_log_and_template,
                    "contact_name": contact_name_from_ul, # Ensure this is used in PDF template
                    "sender_name": sender_name_to_use,
                    "date_generated": datetime.now(timezone.utc).strftime("%B %d, %Y")
                }
                
                email_template_obj = JINJA_ENV.from_string(email_body_html_template)
                rendered_email_body = email_template_obj.render(personalization_data_email)

                pdf_attachment_path = generate_loi_pdf(
                    personalization_data=personalization_data_pdf,
                    lead_id=current_lead_details_for_log_and_template["id"], # original_lead_id
                    contact_email=contact_to_email
                )
                if not pdf_attachment_path:
                    raise Exception("Failed to generate PDF attachment.")

                message_body = create_mime_message(
                    sender_email=sender_email_to_impersonate,
                    to_email=contact_to_email,
                    subject=final_email_subject,
                    body_html=rendered_email_body,
                    attachment_path=pdf_attachment_path,
                    sender_name=sender_name_to_use
                )
                if not message_body:
                    raise Exception("Failed to create MIME message.")

                gmail_service = get_gmail_service(sender_email_to_impersonate)
                if not gmail_service:
                    raise Exception(f"Failed to get Gmail service for {sender_email_to_impersonate}.")

                if send_gmail_message(gmail_service, sender_email_to_impersonate, message_body):
                    email_sent_successfully = True
                    log_to_frontend(f"Successfully sent email to {contact_to_email} for useful_lead_id {useful_lead_id_to_update}.")
                    results['succeeded'] += 1
                else:
                    raise Exception(f"send_gmail_message returned false for {contact_to_email}.")

            except Exception as e:  # Inner except
                error_message_for_log = str(e)
                log_to_frontend(f"Error processing useful_lead_id {useful_lead_id_to_update} for {contact_to_email}: {error_message_for_log}")
                results['failed'] += 1
            
            finally:  # Inner finally
                if email_log_id:
                    status_to_log = 'SENT' if email_sent_successfully else 'FAILED_TO_SEND'
                    sent_at_val = datetime.now(timezone.utc) if email_sent_successfully else None
                    update_email_log_status_in_db(
                        log_id=email_log_id,
                        status=status_to_log,
                        sent_at=sent_at_val,
                        error_message=error_message_for_log
                    )
                
                if email_sent_successfully and useful_lead_id_to_update:
                    try:
                        update_response = supabase.table('useful_leads') \
                            .update({'email_sent': True, 'updated_at': datetime.now(timezone.utc).isoformat()}) \
                            .eq('id', useful_lead_id_to_update) \
                            .execute()
                        if hasattr(update_response, 'error') and update_response.error:
                            log_to_frontend(f"Failed to mark useful_lead_id {useful_lead_id_to_update} as sent: {update_response.error.message}")
                    except Exception as e_update:
                        log_to_frontend(f"Exception marking useful_lead_id {useful_lead_id_to_update} as sent: {str(e_update)}")

                if pdf_attachment_path and os.path.exists(pdf_attachment_path):
                    try:
                        os.remove(pdf_attachment_path)
                        log_to_frontend(f"Successfully deleted temporary PDF: {pdf_attachment_path}")
                    except Exception as e_remove:
                        log_to_frontend(f"Error deleting temporary PDF {pdf_attachment_path}: {str(e_remove)}")
        
        log_to_frontend(f"Campaign processing run finished for market: {market_region}. Results: {results}")

    except Exception as e_outer:  # Outer except
        log_to_frontend(f"Outer exception in campaign processing for {market_region}: {str(e_outer)}")
        if results['attempted'] == 0: # If no leads were even attempted due to an early outer error
             results['failed'] = limit_per_run
    
    return results



@app.route('/test-email-send', methods=['POST'])
def test_email_send_route():
    global supabase, SENDER_ACCOUNTS, subject_template_global, body_template_global, JINJA_ENV
    if not supabase and not init_supabase_client(): 
        log_to_frontend("test_email_send_route: Supabase not initialized.")
        return jsonify({"error": "Supabase client not initialized"}), 500

    pdf_path = None  # Initialize pdf_path for the finally block
    try:
        if not SENDER_ACCOUNTS:
            log_to_frontend("test_email_send_route: Loading sender accounts...")
            load_sender_accounts() # Assumes this function is defined and loads SENDER_ACCOUNTS
            if not SENDER_ACCOUNTS:
                log_to_frontend("Error: No sender accounts loaded for test send.")
                return jsonify({"error": "No sender accounts loaded"}), 500
        
        test_sender_info = SENDER_ACCOUNTS[0]
        test_sender_email_address = test_sender_info['email']
        test_sender_display_name = test_sender_info['name']

        # Ensure email template strings are loaded
        if subject_template_global is None or body_template_global is None:
            subject_str_template, body_str_template = load_email_template_from_file(EMAIL_TEMPLATE_FILE)
            if subject_str_template is None or body_str_template is None:
                log_to_frontend("Error: Email templates not loaded for test send.")
                return jsonify({"error": "Email templates not loaded"}), 500
            subject_template_global = subject_str_template
            body_template_global = body_str_template

        # Fetch a sample lead (non 'Vacant Land')
        response = supabase.table('useful_leads') \
            .select('*') \
            .neq('property_type', 'Vacant Land') \
            .limit(1) \
            .execute()
            
        if not response.data:
            log_to_frontend("Error: No eligible (non-Vacant Land) leads found in useful_leads for test data.")
            return jsonify({"error": "No eligible leads found in useful_leads for test data"}), 404
            
        lead_sample = response.data[0]
        actual_test_recipient_email = "chrisphillips@truesoulpartners.com" # Hardcoded test recipient

        # Prepare personalization data
        personalization_data = {k: (v if v is not None else '') for k, v in lead_sample.items()}
        personalization_data.setdefault('current_date', datetime.now().strftime('%B %d, %Y'))
        personalization_data.setdefault('sender_name', test_sender_display_name)

        # Render email subject and body using Jinja2
        jinja_subject_template = JINJA_ENV.from_string(subject_template_global)
        jinja_body_template = JINJA_ENV.from_string(body_template_global)
        
        subject = jinja_subject_template.render(personalization_data)
        body_html = jinja_body_template.render(personalization_data)

        # Generate LOI PDF
        lead_id_for_pdf = lead_sample.get('id', lead_sample.get('normalized_lead_id', 'TestLead'))

        log_to_frontend(f"Attempting to generate PDF with data for lead ID {lead_id_for_pdf}")
        pdf_path = generate_loi_pdf(personalization_data, lead_id_for_pdf, actual_test_recipient_email)
        
        if not pdf_path:
            log_to_frontend(f"Failed to generate PDF for test email. Proceeding without attachment.")
            # Consider if this should be an error: return jsonify({"error": "Failed to generate PDF for test email."}), 500

        service = get_gmail_service(test_sender_email_address)
        if not service:
            log_to_frontend(f"Failed to get Gmail service for {test_sender_email_address}")
            return jsonify({"error": f"Failed to get Gmail service for {test_sender_email_address}"}), 500

        message_body = create_mime_message(
            sender_email=test_sender_email_address,
            to_email=actual_test_recipient_email,
            subject=subject,
            body_html=body_html,
            attachment_path=pdf_path, # Pass the generated PDF path here
            sender_name=test_sender_display_name
        )

        if send_gmail_message(service, test_sender_email_address, message_body):
            log_to_frontend(f"Test email {'with PDF' if pdf_path else 'without PDF'} sent successfully from {test_sender_email_address} to {actual_test_recipient_email} for lead ID {lead_id_for_pdf}.")
            return jsonify({"message": "Test email sent successfully."}), 200
        else:
            log_to_frontend(f"Failed to send test email from {test_sender_email_address} to {actual_test_recipient_email}.")
            return jsonify({"error": "Failed to send test email."}), 500
            
    except Exception as e:
        log_to_frontend(f"Exception in test_email_send_route: {str(e)}")
        # import traceback # Uncomment for detailed debugging
        # log_to_frontend(traceback.format_exc())
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500
    finally:
        if pdf_path and os.path.exists(pdf_path):
            try:
                os.remove(pdf_path)
                log_to_frontend(f"Successfully deleted temporary PDF: {pdf_path}")
            except Exception as e_remove:
                log_to_frontend(f"Error deleting temporary PDF {pdf_path}: {e_remove}")

# Function to get distinct market regions
@app.route('/api/market-regions', methods=['GET'])
def get_market_regions():
    global supabase
    if not supabase:
        log_to_frontend("get_market_regions: Supabase client not initialized.")
        return jsonify({"error": "Supabase client not initialized"}), 500
    
    try:
        # Fetch all market_region entries. We'll make them unique in Python.
        # Adding count='exact' to potentially get total count if needed, though not strictly used for unique values here.
        response = supabase.table('useful_leads').select('market_region', count='exact').execute() 
        
        if hasattr(response, 'data') and response.data:
            # Extract unique market regions
            # Using a set to ensure uniqueness and then converting to a list
            # Also filtering out None or empty string/whitespace-only values if they exist
            market_regions = list(set(item['market_region'] for item in response.data if item['market_region'] and item['market_region'].strip()))
            market_regions.sort() # Optional: sort them alphabetically
            log_to_frontend(f"Successfully fetched market regions: {market_regions}")
            return jsonify(market_regions)
        elif hasattr(response, 'error') and response.error:
            log_to_frontend(f"Error fetching market regions: {response.error.message}")
            return jsonify({"error": f"Error fetching market regions: {response.error.message}"}), 500
        else:
            # This case handles when response.data is empty or None, but no explicit Supabase error.
            log_to_frontend("No market regions found or unexpected response from Supabase for market regions.")
            return jsonify([]) # Return empty list if no regions found

    except Exception as e:
        log_to_frontend(f"Exception in /api/market-regions: {str(e)}")
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500


if __name__ == '__main__':
    print("Starting ELI5 Full-Stack Engine with Supabase Integration...")
    if not init_supabase_client():
        print("Failed to initialize Supabase client. Please check configuration and network. Application might not work correctly.")
    
    print("Loading sender accounts...")
    load_sender_accounts() # Load sender accounts after initializations
    # Log how many accounts were loaded, or if none were found (e.g., if CSV was empty or headers were wrong despite the fix)

    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=True, allow_unsafe_werkzeug=True)
