#!/bin/bash

# Ruta al script de Python (ajustar según el entorno del usuario)
PYTHON_SCRIPT="./qrng_api.py"

# Ruta al ejecutable de Python (ajustar según el entorno del usuario)
PYTHON_EXEC="python3"

# Función para reiniciar el servidor
restart_server() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") - Reiniciando el servidor..." >&2
    $PYTHON_EXEC "$PYTHON_SCRIPT"
    echo "$(date +"%Y-%m-%d %H:%M:%S") - Servidor reiniciado." >&2
}

# Ejecutar el servidor
echo "$(date +"%Y-%m-%d %H:%M:%S") - Iniciando el servidor..." >&2
$PYTHON_EXEC "$PYTHON_SCRIPT"

# Si el script de Python se cierra, reiniciarlo
if [ $? -ne 0 ]; then
    restart_server
fi
