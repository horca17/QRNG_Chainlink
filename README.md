<<<<<<< HEAD
# QRNG_Chainlink
A cross-chain lottery application that generates quantum random numbers using IBM Quantum (ibm_sherbrooke) and integrates Chainlink Functions with Avalanche for verifiable randomness.
=======
# Quantum Random Number Generator (Chainlink Hackathon 2025)

## Overview

Quantum Random Number Generator (QRNG) is a cross-chain lottery application that generates truly unpredictable three-digit random numbers (e.g., 042) using quantum computing via IBM Quantum Systems (backend: ibm_sherbrooke). It integrates Chainlink Functions to manage API calls and ensure verifiable randomness on the Avalanche blockchain, aiming for efficiency with one API call per request. This project demonstrates how quantum computing can enhance decentralized applications by providing true randomness for use cases like lotteries, ensuring transparency and trust.

## Features

- Generates 3-digit random numbers (e.g., 042) using quantum computing.
- Uses Chainlink Functions for integration with Avalanche.
- Deployed with Serveo and ngrok for stable access during development and demo.
- Simple user interface to initialize the server and obtain random numbers.

## Tech Stack

- **Quantum Computing**: IBM Quantum (backend: ibm_sherbrooke) for true randomness.
- **Blockchain**: Chainlink Functions for API calls and Avalanche for cross-chain deployment.
- **Backend**: Node.js with WebSocket (`backend/index.js`) for real-time communication.
- **Frontend**: HTML/CSS/JavaScript for a minimalistic interface.
- **APIs**: `scripts/qrng_api.py` to connect with IBM Quantum.
- **Deployment**: Serveo and ngrok to expose the local server.

## Setup

### Prerequisites
- Node.js and npm installed.
- Python 3.x to run the API script (`scripts/qrng_api.py`).
- An IBM Quantum account with access to the ibm_sherbrooke backend.
- Access to Chainlink Functions and a wallet configured for Avalanche.

### Installation
1. Clone the repository:

git clone https://github.com/horca17/QRNG_Chainlink.git

2. Install backend dependencies:

cd QRNG_Chainlink/backend npm install

(Check `backend/package.json` for dependencies).

3. Configure IBM Quantum credentials in `scripts/qrng_api.py` (API token and backend).

4. Run the backend server:

npm start

5. Expose the local servers using Serveo and ngrok (run these in separate terminals):
   - **For the backend server** (running on port 5005):

ngrok http 5005

Note: After running ngrok, it will provide a URL (e.g., `https://random-ngrok-url.ngrok-free.app`). Update the frontend configuration (in `frontend/script.js`) to use this URL for backend API calls. If you have a custom ngrok domain, use the `--domain` flag (e.g., `ngrok http --domain=your-custom-domain.ngrok-free.app 5005`).
- **For the frontend** (running on port 3000):

autossh -M 0 -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R your-subdomain:80:localhost:3000 serveo.net

Note: Replace `your-subdomain` with a unique subdomain of your choice (e.g., `mysubdomain`). This will expose the frontend at `your-subdomain.serveo.net`. If you need to use an SSH key for authentication, add the `-i /path/to/your-key` option. Update the backend configuration (in `backend/index.js`) to allow connections from this URL if needed (e.g., CORS settings).




>>>>>>> Subo archivos del proyecto QRNG
