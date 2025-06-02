# api_server.py
from flask import Flask, jsonify
from qiskit import QuantumCircuit
from qiskit_ibm_runtime import QiskitRuntimeService, Sampler, Options
import time
import os

app = Flask(__name__)

MAX_WAIT_TIME = 4 * 60 * 60  # 4 horas en segundos
IBMQ_TOKEN = os.getenv("IBMQ_TOKEN")  # Asegúrate de configurar esta variable de entorno

service = QiskitRuntimeService(channel="ibm_quantum", token=IBMQ_TOKEN)

def get_least_busy_backend():
    backends = service.backends(filters=lambda x: x.configuration().n_qubits >= 2 and
                                                   not x.configuration().simulator)
    return min(backends, key=lambda x: x.status().pending_jobs)

def check_backend_status(backend):
    status = backend.status()
    return {
        "operational": status.operational,
        "pending_jobs": status.pending_jobs,
        "least_busy": backend == get_least_busy_backend()
    }

def estimate_wait_time(backend):
    # Esta es una estimación simplificada. Podrías refinarla basándote en datos históricos.
    return backend.status().pending_jobs * 60  # Asumiendo 1 minuto por job pendiente

@app.route('/quantum_random')
def quantum_random():
    backend = get_least_busy_backend()
    status = check_backend_status(backend)
    estimated_wait = estimate_wait_time(backend)

    if not status['operational'] or estimated_wait > MAX_WAIT_TIME:
        return jsonify({"error": "Backend no disponible o tiempo de espera demasiado largo",
                        "fallback_number": generate_fallback_number()})

    try:
        # Crear un circuito cuántico simple para generar un número aleatorio
        circuit = QuantumCircuit(1, 1)
        circuit.h(0)
        circuit.measure(0, 0)

        # Configurar opciones para Sampler
        options = Options()
        options.execution.shots = 1
        options.optimization_level = 1

        # Usar Sampler de Qiskit Runtime V2
        sampler = Sampler(session=service.open_session(backend=backend))
        job = sampler.run(circuits=[circuit], options=options)
        result = job.result()

        quasi_dists = result.quasi_dists[0]
        random_bit = 1 if quasi_dists.get(1, 0) > 0.5 else 0

        return jsonify({"random_number": random_bit})
    except Exception as e:
        return jsonify({"error": str(e), "fallback_number": generate_fallback_number()})
    finally:
        if 'sampler' in locals():
            sampler.close()

def generate_fallback_number():
    return int(time.time() * 1000) % 2  # Genera 0 o 1 basado en el timestamp actual

if __name__ == '__main__':
    app.run(port=5000)

# control_server.py
import requests
import time
import subprocess

API_SERVER_URL = "http://localhost:5000"
API_SERVER_SCRIPT = "api_server.py"

def check_api_server():
    try:
        response = requests.get(f"{API_SERVER_URL}/quantum_random")
        return 'random_number' in response.json() or 'fallback_number' in response.json()
    except:
        return False

def restart_api_server():
    subprocess.call(["pkill", "-f", API_SERVER_SCRIPT])
    time.sleep(5)
    subprocess.Popen(["python", API_SERVER_SCRIPT])

while True:
    if not check_api_server():
        print("API Server no responde correctamente. Reiniciando...")
        restart_api_server()
    time.sleep(60)  # Verificar cada minuto
