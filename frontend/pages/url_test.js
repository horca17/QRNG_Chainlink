const fetch = require('node-fetch');

const url = `https://9b497939447c7727817519b3436736d4.serveo.net/generate_random`;
//const url = `http://192.168.1.35:5005/generate_random`;
//const url = `https://6107-2803-9810-337e-de10-d5d1-188c-25a2-b74c.ngrok-free.app/generate_random`;

async function simulateSendNumber() {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Response data:', data);
    } catch (error) {
        console.error('There was a problem with the fetch operation:', error);
    }
}

simulateSendNumber();
