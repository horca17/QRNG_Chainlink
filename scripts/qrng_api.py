from qiskit.visualization import plot_histogram
from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
import numpy as np
from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit_aer import AerSimulator
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from qiskit.circuit.library import XGate
from qiskit_ibm_runtime import QiskitRuntimeService
from qiskit_ibm_runtime.fake_provider import FakeAlmadenV2
from qiskit_ibm_runtime.fake_provider import FakeManilaV2
from qiskit_ibm_runtime import SamplerV2 as Sampler
from numpy import pi
from pydantic import BaseModel
import os
import sys
import signal
import time
import logging
import datetime
from flask import Flask, jsonify
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import asyncio
from collections import deque
from starlette.middleware.base import BaseHTTPMiddleware
import uvicorn
import argparse
import random

# Conectar con IBM Quantum Experience
service = QiskitRuntimeService(channel="ibm_quantum", token="128594f5b5b142472bcc80b979e7af34554d1bbad6ffb656107e69656f677c9047c87918adb39e237fb0c37e249000bac3d6d53ee993cdcc1701972ceddac9bc")
#service = QiskitRuntimeService(channel="ibm_quantum", token="8566d55b51b820899ce725840acc2b3d08fb66e591f71dd5bfa37fb42f8a451db853b2488f6ba2d8cd918b73afbd5812faa7dff18a9c6d89578f6e666227a9e9")

# Obtener la lista de backends disponibles
backends = service.backends(operational=True, simulator=False, min_num_qubits=10)

# Inicializar variables para selección de backend
selected_backend = None
min_pending_jobs = float('inf')


# Verificar el número de trabajos pendientes
for backend in backends:
    status = backend.status()
    pending_jobs = status.pending_jobs
    if pending_jobs < 10 :  # Filtrar los backends con 10 o menos trabajos pendientes, con 1 se usa si o si Fake Simulator
        if pending_jobs < min_pending_jobs:
            min_pending_jobs = pending_jobs
            selected_backend = backend

# Si no hay backend adecuado, usar el simulador
if selected_backend is None:
    print("No se encontró un backend con pocos trabajos pendientes. Usando FakeAlmadenV2.")
    backend = FakeAlmadenV2()
else:
    backend = selected_backend
    #backend = FakeAlmadenV2()

# Imprimir el backend seleccionado
#print(f"Backend seleccionado: {backend.name}")

# Define a local backend
#backend = FakeAlmadenV2()
#backend = FakeManilaV2()

# Conectar con IBM Quantum Experience
#service = QiskitRuntimeService()
#backend = service.least_busy(operational=True, simulator=False, min_num_qubits=10)
#backend = service.backend("ibm_brisbane")
#backend = service.backend("ibm_kyiv")
#backend = service.backend("ibm_sherbrooke")

print(f"Backend seleccionado: {backend.name}")

# Declarar la variable del contador
retry_count = 0
quantum_number = 0
is_generating = False  # Variable de estado para indicar si el número está en proceso de generación
request_queue = deque()
request_counter = 0  # Contador global de solicitudes
should_restart = False  # Estado de reinicio
should_restart_frontend = False
random_number = 0

app = FastAPI()

# Configuración de CORS
origins = [
    "http://0.0.0.0",
    "http://localhost",
    "http://localhost:5005",
    "http://localhost:3000",
    "https://quantumoraclenumber.loca.lt",
    "https://9b497939447c7727817519b3436736d4.serveo.net",
    "https://functions.chain.link/playground",
    "https://3ebc-2803-9810-b028-c710-a00d-267c-1866-c128.ngrok-free.app",
    "https://qubistry.serveo.net",
    "https://6107-2803-9810-337e-de10-d5d1-188c-25a2-b74c.ngrok-free.app"
]


# Middleware para contar solicitudes
class RequestCounterMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        global request_counter
        request_counter += 1
        logging.info(f"Total requests handled: {request_counter}")

        # Verificar si se debe reiniciar el servidor
        if should_restart:
            logging.info("Restarting server before processing request...")
            await restart_server()

        response = await call_next(request)
        return response

# Registrar el middleware para contar solicitudes
app.add_middleware(RequestCounterMiddleware)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración de Rate Limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"message": "Rate limit exceeded. Try again later."}
    )

@app.get("/")
async def get():
    return HTMLResponse("""
    <!DOCTYPE html>
    <html>
        <head>
            <title>WebSocket Test</title>
        </head>
        <body>
            <h1>WebSocket Test</h1>
            <div id="health-indicator" style="width: 20px; height: 20px; border-radius: 50%; background-color: red; position: fixed; top: 10px; right: 10px;"></div>
            <script>
                const ws = new WebSocket("wss://9b497939447c7727817519b3436736d4.serveo.net/ws");
                ws.onmessage = function(event) {
                    const data = JSON.parse(event.data);
                    const indicator = document.getElementById('health-indicator');
                    if (data.status === 'ok') {
                        indicator.style.backgroundColor = 'green';
                    } else {
                        indicator.style.backgroundColor = 'red';
                    }
                };
            </script>
        </body>
    </html>
    """)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global should_restart_frontend, quantum_number, retry_count, backend_name  # Declarar la variable global
    #quantum_number = 0
    await websocket.accept()
    try:
        backend_name = backend.name  # Reemplaza con la lógica correcta para obtener el nombre del backend
        while True:
            #if should_restart_frontend:
            #    await websocket.send_json({"action": "restart"})
            #    should_restart_frontend = False
            #else:
            await websocket.send_json({"status": "ok", "backendName": backend_name})
            await asyncio.sleep(2)

            if quantum_number != 0: # Verificar si hay un número generado
                await websocket.send_json({"randomNumber": quantum_number})
                #quantum_number = 0  # Reiniciar quantum_number
            #await asyncio.sleep(5)

    except WebSocketDisconnect:
        logging.warning("Client disconnected")
    except Exception as e:
        logging.error(f"Error in WebSocket endpoint: {e}")
    #finally:
        #if should_restart_frontend:
        #    await websocket.send_json({"action": "restart"})
        #    should_restart_frontend = False


@app.get('/get_generated_number')
async def get_generated_number():
    global quantum_number
    if quantum_number == 0:
        return {"random_number": "000"}
    return {"random_number": quantum_number}

@app.get('/')
def hello():
    return "¡Hola! El servidor está funcionando."

@app.get('/backend_name')
def get_backend_name():
    return {backend.name}

@app.get('/generate_random')
@limiter.limit("5/minute")
async def get_random_number(request: Request):
    global retry_count, quantum_number, is_generating, request_counter, request_queue, should_restart, random_number
    retry_count += 1
    print(f"Intento número: {retry_count}")

    # Añadir la solicitud a la cola
    request_queue.append(request)

    # Esperar hasta que la solicitud esté en la cabeza de la cola
    while request_queue[0] != request:
        await asyncio.sleep(3)  # Esperar 3 segundos antes de verificar nuevamente

    if quantum_number == 0 and not is_generating:
        is_generating = True
        try:
            # Circuito random
            #await asyncio.sleep(1)
            # random_number += 1
            #random_number = random.randint(1, 100) # Generar un entero aleatorio entre 1 y 100
            
            # Crear el circuito cuántico
            num_qubits = 10  # Esto generará números de 0 a 1023
            qc = QuantumCircuit(num_qubits)
            qc.h(range(num_qubits))  # Aplicar puerta Hadamard a todos los qubits
            qc.measure_all()

            # Generar el pass manager para la optimización
            pm = generate_preset_pass_manager(optimization_level=1, backend=backend)
            # Optimizar el circuito
            isa_circuit = pm.run(qc)
            # Ejecutar el circuito
            sampler = Sampler(backend)
            job = sampler.run([isa_circuit])
            pub_result = job.result()[0]
            # Obtener los conteos
            counts = pub_result.data.meas.get_counts()
            # Convertir el resultado binario a decimal
            random_number = int(list(counts.keys())[0], 2)
            
            
            
            # Asegurarse de que el número tenga 3 cifras
            formatted_random_number = f"{random_number:03d}"
            formatted_random_number = int(formatted_random_number)

            # Almacenar el número cuántico generado
            quantum_number = formatted_random_number

            # Reiniciar el servidor después de entregar un resultado
            logging.basicConfig(filename='/tmp/api_server.log', level=logging.INFO)
            logging.info(f"Ultimo Numero Random emitido: {formatted_random_number}")
        finally:
            is_generating = False

    # Esperar hasta que el número cuántico esté disponible
    while quantum_number == 0:
        await asyncio.sleep(1)  # Esperar 1 segundo antes de verificar nuevamente

    # Eliminar la solicitud de la cola
    request_queue.popleft()

    # Si es la cuarta solicitud, devolver el número cuántico generado
    if request_counter > 7 and retry_count > 5:
        await asyncio.sleep(1)
        logging.basicConfig(filename='/tmp/api_server.log', level=logging.INFO)
        logging.info("Restarting server after fourth request...")
        #await soft_restart()
        await restart_server()
        retry_count = 0
        quantum_number = 0
        should_restart = True  # Activar el estado de reinicio

    return {"random_number": quantum_number}

@app.get('/initialize_server')
async def initialize_server():
    logging.info("Initializing server...")
    # Aquí puedes poner la lógica para inicializar el servidor
    await restart_server()
    return {"status": "Server initialized"}

@app.get('/request_count')
async def get_request_count():
    return {"request_count": request_counter}

@app.get('/force_restart')
async def force_restart():
    logging.info("Force restarting server...")
    await restart_server()
    return {"status": "restarting"}
    
    
async def restart_server():
    global retry_count, quantum_number, is_generating, request_counter, should_restart, request_tqueue, should_restart_frontend, random_number
    logging.basicConfig(filename='/tmp/api_server.log', level=logging.INFO)
    logging.info("Restarting server...")
    # Aquí puedes poner la lógica para reiniciar el servidor
    #should_restart_frontend = True
    retry_count = 0
    quantum_number = 0
    is_generating = False
    request_counter = 0
    should_restart = False
    request_queue = deque()
    random_number = 0
    # Lógica adicional para reiniciar el servidor si es necesario
    await asyncio.sleep(1)  # Delay before restart
    os.kill(os.getpid(), signal.SIGTERM)  # Graceful shutdown    
    
async def soft_restart():
    logging.info("Performing soft restart...")
    await asyncio.sleep(5)  # Delay before restart
    os.execv(sys.executable, [sys.executable] + sys.argv)  # Restart the server

def run_server():
    logging.info(f"Starting API server at {datetime.datetime.now()}")
    logging.info(f"Backend seleccionado: {backend.name}")

    # Configuración de Uvicorn
    config = uvicorn.Config(
        "qrng_api:app",  # Reemplaza con la ruta correcta a tu objeto app
        host='0.0.0.0',
        port=5005,
        log_level="debug",
        #reload=False,
        #limit_max_requests=10000,  # Mantener el límite de 4 solicitudes antes de reiniciar
        #ws="auto",  # Protocolo WebSocket
        #ws_max_size=16777216,  # Tamaño máximo del mensaje WebSocket (16MB)
        #ws_max_queue=32,  # Longitud máxima de la cola de mensajes WebSocket
        #ws_ping_interval=20.0,  # Intervalo de ping del WebSocket (segundos)
        #ws_ping_timeout=20.0,  # Tiempo de espera del ping del WebSocket (segundos)
    )

    # Iniciar el servidor con la configuración
    server = uvicorn.Server(config)
    server.run()

# Ejecutar esto en una celda de Jupyter para iniciar el servidor
if __name__ == '__main__':
    logging.basicConfig(filename='/tmp/api_server.log', level=logging.INFO)
    run_server()


