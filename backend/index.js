from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Configuración CORS
origins = [
    "http://localhost",
    "http://localhost:5005",
    "http://localhost:3000",
    "https://52fd-2803-9810-3378-a210-f94e-bb51-350a-aa6c.ngrok-free.app",
    # Agrega aquí cualquier otro origen permitido
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/generate_random")
async def generate_random():
    import random
    return {"random_number": random.randint(1, 1000)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5005)
