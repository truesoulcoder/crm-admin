# test_eli5_client.py
import socketio
import time

sio = socketio.Client(logger=True, engineio_logger=True) # Added logging for more detail

@sio.event
def connect():
    print('Connected to ELI5-ENGINE server')
    start_campaign()

@sio.event
def connect_error(data):
    print(f"Connection failed: {data}")

@sio.event
def disconnect():
    print('Disconnected from ELI5-ENGINE server')

@sio.on('campaign_progress')
def on_campaign_progress(data):
    print(f"Campaign Progress: {data}")
    
@sio.on('log_message') # General log messages from log_to_frontend
def on_log_message(data):
    print(f"ELI5-LOG: {data.get('message')}")

@sio.on('campaign_finished')
def on_campaign_finished(data):
    print(f"Campaign Finished: {data.get('message')}")
    sio.disconnect()

@sio.on('campaign_error')
def on_campaign_error(data):
    print(f"Campaign Error: {data.get('message')}")
    sio.disconnect()

def start_campaign():
    campaign_data = {
        'market_region': 'FLORIDA', # IMPORTANT: Use a market region that exists in your normalized_leads
        'email_subject_template': 'LOI for Your Property at {property_address}',
        'email_body_template': (
            "<p>Dear {contact_name},</p>"
            "<p>My name is {senders_name} from True Soul Partners LLC.</p>"
            "<p>We are interested in your property located at {property_address}.</p>"
            "<p>Please find our Letter of Intent attached for your review.</p>"
            "<p>This offer is based on an estimated wholesale value of {offer_price} (calculated from initial data).</p>" # Example of using another placeholder
            "<p>We look forward to hearing from you.</p>"
            "<p>Sincerely,<br>{senders_name}</p>"
        )
    }
    print(f"Emitting 'start_campaign' to ELI5-ENGINE with data: {campaign_data}")
    sio.emit('start_campaign', campaign_data)

if __name__ == '__main__':
    try:
        # Ensure app.py is running and accessible on localhost:5000
        sio.connect('http://localhost:5000') 
        sio.wait() 
    except socketio.exceptions.ConnectionError as e:
        print(f"Connection to ELI5-ENGINE failed: {e}")
        print("Please ensure app.py (ELI5-ENGINE) is running.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    finally:
        if sio.connected:
            sio.disconnect()