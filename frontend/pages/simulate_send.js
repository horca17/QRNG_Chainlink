const fetch = require('node-fetch');

const url = `https://9b497939447c7727817519b3436736d4.serveo.net/generate_random`;

// Enviar datos simulados
const dataToSend = {
  random_number: 123  // Asegúrate de que esto sea lo que el servidor espera
};

async function simulateSendNumber() {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dataToSend)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Simulated response sent:', data);
  } catch (error) {
    console.error('There was a problem with the fetch operation:', error);
  }
}

simulateSendNumber();
