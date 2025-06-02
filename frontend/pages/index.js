import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import QuantumOracleABI from '/Users/horaciocaceres/quantum_oracle_project/artifacts/contracts/QuantumOracle.sol/QuantumOracle.json';

const CONTRACT_ADDRESS = "0xaE674AA888eb7E233B6011cAaB56C77Ca0972Aa4"; // ngrok total 
//const CONTRACT_ADDRESS = "0x663877074AE09DEA531B01A651D2FCE573e18f2D"; //nqrok con localhost
//const CONTRACT_ADDRESS = "0x266E295147FEA4EFB9bd5abA969217da34ac718f";// con serveo
const ACCESS_CODE = 'ag736ot'; // Replace with the actual access code

export default function Home() {
  const [randomNumber, setRandomNumber] = useState('0');
  const [backendName, setBackendName] = useState('Checking...');
  const [loadingRandom, setLoadingRandom] = useState(false);
  const [loadingBackend, setLoadingBackend] = useState(false);
  const [loadingInitialize, setLoadingInitialize] = useState(false);
  const [error, setError] = useState(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [networkCorrect, setNetworkCorrect] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [serverInitialized, setServerInitialized] = useState(false); // Nuevo estado
  const [loadingQuantum, setLoadingQuantum] = useState(false);

  const fujiNetwork = {
    chainId: '0xA869',
    chainName: 'Avalanche Fuji C-Chain',
    nativeCurrency: {
      name: 'Avalanche',
      symbol: 'AVAX',
      decimals: 18,
    },
    rpcUrls: ['https://api.avax-test.network/ext/C/rpc'],
    blockExplorerUrls: ['https://cchain.explorer.avax-test.network/'],
  };


  // Leer el estado desde localStorage al iniciar
useEffect(() => {
  const initialized = localStorage.getItem('serverInitialized') === 'true';
  setServerInitialized(initialized);
}, []);

// Guardar el estado en localStorage cuando cambia
useEffect(() => {
  localStorage.setItem('serverInitialized', serverInitialized);
}, [serverInitialized]);


  useEffect(() => {
    async function initialize() {
      await checkConnection();
    }

    initialize();

    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('accountsChanged', handleAccountsChanged);
    }

    return () => {
      if (typeof window.ethereum !== 'undefined') {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  useEffect(() => {
    if (walletConnected && networkCorrect) {
      checkIfOwner(); // Ensure to check owner status once wallet is connected
    }
  }, [walletConnected, networkCorrect]);

  useEffect(() => {
    let ws;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 100; // Limitar el número de intentos de reconexión
    let reconnectInterval = 5000; // Intervalo de reconexión en milisegundos

    const initializeWebSocket = () => {
    //const ws = new WebSocket("wss://9b497939447c7727817519b3436736d4.serveo.net/ws");
    //const ws = new WebSocket("ws://localhost:5005/ws");
    const ws = new WebSocket("wss://midge-primary-slightly.ngrok-free.app/ws");

    ws.onopen = function() {
      console.log('WebSocket connection opened');
      reconnectAttempts = 0; // Reiniciar el contador de intentos de reconexión
      const indicator = document.getElementById('health-indicator');
      indicator.style.backgroundColor = '#0f8b8d'; // Indicador de conexión exitosa
    };


    ws.onmessage = function(event) {
      const data = JSON.parse(event.data);
      const indicator = document.getElementById('health-indicator');
      if (data.status === 'ok') {
        indicator.style.backgroundColor = '#0f8b8d';
      } else {
        indicator.style.backgroundColor = 'red';
      }
      // Verificar si se ha recibido el número aleatorio
      if (data.randomNumber) {
        setRandomNumber(data.randomNumber);
        setLoadingRandom(false);
        setLoadingQuantum(false);
      } else if ((data.randomNumber === undefined || data.randomNumber === null) && (loadingRandom === true)) {
        //setRandomNumber(data.randomNumber);
        //setLoadingRandom(true);
        //setLoadingQuantum(true);
      }

      // Verificar si se ha recibido el nombre del backend
      if (data.backendName) {
        setBackendName(data.backendName);
      }

      // Nueva funcionalidad: Manejar el mensaje de reinicio
      //if (data.action === 'restart') {
      //    location.reload();
      //}
    };

    ws.onerror = function() {
      console.error("WebSocket error:", error);
      const indicator = document.getElementById('health-indicator');
      indicator.style.backgroundColor = 'red';
    };
    ws.onclose = function(event) {
      console.log("WebSocket closed:", event);
      const indicator = document.getElementById('health-indicator');
      indicator.style.backgroundColor = 'red';
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
     
      // Attempt to reconnect after a delay
      setTimeout(() => {
        initializeWebSocket();
      }, reconnectInterval); // Retry connection every 5 seconds
    } else {
      console.log("Max reconnect attempts reached. Giving up.");
    } 
    };
  };

  initializeWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  async function checkConnection() {
    if (typeof window.ethereum !== 'undefined') {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.listAccounts();
      setWalletConnected(accounts.length > 0);
      if (accounts.length > 0) {
        await checkNetwork();
      }
    }
  }

  async function checkNetwork() {
    if (typeof window.ethereum !== 'undefined') {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      setNetworkCorrect(network.chainId === parseInt(fujiNetwork.chainId, 16));
    }
  }

  async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
      setError('MetaMask is not installed');
      return;
    }
    setConnecting(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      setWalletConnected(true);
      await checkNetwork();
      if (!networkCorrect) {
        await switchNetwork();
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setError('Error connecting wallet: ' + error.message);
    } finally {
      setConnecting(false);
    }
  }

  async function switchNetwork() {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: fujiNetwork.chainId }],
      });
      setNetworkCorrect(true);
    } catch (error) {
      console.error('Error switching network:', error);
      setError('Error switching network: ' + error.message);
    }
  }

  function handleChainChanged() {
    window.location.reload();
  }

  function handleAccountsChanged(accounts) {
    setWalletConnected(accounts.length > 0);
    if (accounts.length > 0) {
      checkNetwork();
      checkIfOwner();
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && walletConnected) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, QuantumOracleABI.abi, signer);

      const handleRandomNumberFulfilled = (requestId, result) => {
        console.log('Event emitted: Response');
        console.log('Request ID:', requestId);
        console.log('Raw result:', result);
        console.log('Formatted result:', result.toString());
      if (result !== 0 || result !== undefined || result !== null) { // Verificar si el número recibido no es 0 
        setRandomNumber(result.toString());
        //setLoadingRandom(false);
        //setLoadingQuantum(false); // Iniciar el indicador de actividad 
      } 
      if (result === 0 || result === undefined || result === null) { // Verificar si el número recibido no es 0
        setRandomNumber(result.toString());
        //setLoadingQuantum(true); // Iniciar el indicador de actividad
        //setLoadingRandom(true);
      }
      };

      contract.on('Response', handleRandomNumberFulfilled);

      return () => {
        contract.off('Response', handleRandomNumberFulfilled);
      };
    }
  }, [walletConnected]);

  async function sendRequest() {
    if (loadingRandom) return;
    setLoadingRandom(true);
    setLoadingQuantum(true); // Iniciar el indicador de actividad
    setError(null);
    setServerInitialized(false);

    try {
      if (!walletConnected || !networkCorrect) {
        await connectWallet();
        if (!walletConnected || !networkCorrect) {
          throw new Error('Wallet not connected or on incorrect network');
        }
      }

      // Verificar si el usuario es owner antes de hacer la solicitud
      await checkIfOwner();

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, QuantumOracleABI.abi, signer);

      console.log('Requesting random number...');
      console.log('Is owner:', isOwner);

      let tx;
      const subscriptionId = 11360;
      if (isOwner) {
        // Si es owner, usa una cadena vacía como código de acceso
        tx = await contract.sendRequest(subscriptionId, ACCESS_CODE);
      } else {
        // Si no es owner, verifica el código de acceso
        if (!accessCode) {
          throw new Error('Access code is required for non-owners');
        }
        tx = await contract.sendRequest(subscriptionId, accessCode);
      }

      console.log('Transaction sent:', tx.hash);

      await tx.wait();
      console.log('Transaction confirmed');

      // Escuchar el evento Response del contrato
      let numberReceived = false;
      contract.on('Response', async (requestId, result) => {
        console.log(`Random number fulfilled: ${result}`);
        if (result !== 0 || result !== undefined || result !== null) { // Verificar si el número recibido no es 0
          setRandomNumber(result.toString());
          //setLoadingRandom(false);
          //setLoadingQuantum(false); // Iniciar el indicador de actividad
          //setServerInitialized(true); // Habilitar el botón de generar número
          numberReceived = true;
        } else {
          // Si se recibe 0, está vacío o es nulo, mostrarlo como marcador temporal y mantener el indicador encendido
          setRandomNumber(result.toString());
          setLoadingQuantum(true);
          //setLoadingRandom(true);
          // ... (código para realizar un reintento y actualizar el número cuando esté disponible) 
        }
      });

      // Esperar 60 segundos antes de reintentar la solicitud al backend
      //await new Promise(resolve => setTimeout(resolve, 10000)); // Esperar 60 segundos

      // Si no se ha recibido el número a través del evento, hacer una solicitud al backend para obtener el número ya generado
      //if (!numberReceived) {
        // Esperar a que el WebSocket envíe el número
      //  await new Promise(resolve => {
      //    const wsListener = (event) => {
      //      const data = JSON.parse(event.data);
      //      if (data.randomNumber && data.randomNumber !== '000') {
      //        setRandomNumber(data.randomNumber);
      //        setLoadingRandom(false);
      //        setLoadingQuantum(false);
              //ws.removeEventListener('message', wsListener);
      //        resolve();
       //     }
       //   };
          //ws.addEventListener('message', wsListener);
      //  });
        
      //} else {
       // console.log('Initialize Server.');//aqui estoy luego de hacer una inicializacion
        // Si el número es '000', mantener el indicador de actividad activo
        //setLoadingRandom(true);
        //setLoadingQuantum(true); // Mantener el indicador de actividad activo

      //}
    } catch (err) {
        console.error('Request failed:', err);
        setError('Error: ' + err.message);
        //setLoadingRandom(false);
        //setLoadingQuantum(false); // Iniciar el indicador de actividad
        setServerInitialized(true); // Habilitar el botón de generar número
    }
  }
  async function checkIfOwner() {
    if (typeof window.ethereum !== 'undefined') {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, QuantumOracleABI.abi, signer);
      try {
        const owner = await contract.owner();
        const accounts = await provider.listAccounts();
        const isOwnerNow = accounts[0].toLowerCase() === owner.toLowerCase();
        console.log('Is owner:', isOwnerNow);
        setIsOwner(isOwnerNow);
      } catch (error) {
        console.error('Error checking owner:', error);
        setIsOwner(false);
      }
    }
  }

  async function fetchBackendName() {
    if (loadingBackend) {
      console.log('Previous request still pending. Please wait.');
      return;
    }
    setLoadingBackend(true);
    setError(null);
    //setServerInitialized(false);

    try {
      //const response = await fetch('https://9b497939447c7727817519b3436736d4.serveo.net/backend_name');
      //const response = await fetch('http://localhost:5005/backend_name');
      //const response = await fetch('https://0d2f-2803-9810-337e-de10-12b-7324-38b7-47e3.ngrok-free.app/backend_name');
      const response = await fetch("https://midge-primary-slightly.ngrok-free.app/backend_name");
       
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const name = await response.text();
      setBackendName(name);
    } catch (err) {
      console.error('Fetch failed:', err);
      setError(err.message);
    } finally {
      setLoadingBackend(false);
    }
  };

  async function initializeServer() {
    if (loadingInitialize) {
      console.log('Previous request still pending. Please wait.');
      return;
    }
    setLoadingInitialize(true);
    setError(null);

    try {
      //const response = await fetch('https://9b497939447c7727817519b3436736d4.serveo.net/initialize_server');
      //const response = await fetch('http://localhost:5005/initialize_server');
      //const response = await fetch('https://0d2f-2803-9810-337e-de10-12b-7324-38b7-47e3.ngrok-free.app/initialize_server');
      const response = await fetch("https://midge-primary-slightly.ngrok-free.app/initialize_server");
       
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      console.log('Server initialized:', result);
      setServerInitialized(true); // Habilitar el botón de generar número después de inicializar el servidor de la API
    } catch (err) {
      console.error('Initialization failed:', err);
      setError(err.message);
    } finally {
      setLoadingInitialize(false);
    }
  }

useEffect(() => {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes dotFlashing {
      0% { opacity: 1; }
      50% { opacity: 0.3; }
      100% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  return () => {
    document.head.removeChild(style);
  };
}, []);

    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Quantum Random Number Generator</h1>
        <div style={styles.card}>
          <p style={styles.description}>
            Get a real random number generated via quantum computing with IBM Quantum Systems, Chainlink and Avalanche!
          </p>
          {!isOwner && (
            <input
              type="text"
              placeholder="Enter access code"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              style={{ ...styles.input, width: '160px', textAlign: 'center' }}
            />
          )}
          <button onClick={initializeServer} disabled={loadingInitialize} style={{ ...styles.buttonN, width: '200px', textAlign: 'center' }}>
            {loadingInitialize ? 'Initializing...' : 'Initialize Server'}
          </button>
          <button onClick={sendRequest} disabled={loadingRandom || !serverInitialized} style={{ ...styles.buttonN, width: '200px', textAlign: 'center'}}>
            {loadingRandom ? 'Processing...' : 'Get Random Number'}
          </button>
          {!serverInitialized && <p>Please initialize the server first.</p>}
          {!(loadingRandom || loadingQuantum) && (randomNumber) && (
          <p style={styles.result}>
            Random Number: {randomNumber.toString().padStart(3, '0')}
          </p>
        )}
          {error && <p style={styles.error}>{error}</p>}
        </div>
        <div style={styles.animation}>
          <div style={styles.line}></div>
          <div id="health-indicator" style={styles.healthIndicator}></div>
        </div>
        <p style={styles.ibmQuantumBackend}>
          IBM Quantum Backend: {backendName}
        </p>
        {!walletConnected && !connecting && (
          <button onClick={connectWallet} style={styles.button}>Connect Wallet</button>
        )}
        {connecting && <p>Connecting...</p>}
        {loadingQuantum && (
          <div style={styles.dots}>
            <div style={{...styles.dot, ...styles.dot1}}></div>
            <div style={{...styles.dot, ...styles.dot2}}></div>
            <div style={{...styles.dot, ...styles.dot3}}></div>
          </div>
        )}
      </div>
    );
  }


  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0f0f0f',
      color: '#fff',
      fontFamily: 'Arial, sans-serif',
    },
    title: {
      fontSize: '3rem',
      marginBottom: '2rem',
      color: '#0f8b8d',
      textShadow: '2px 2px 10px rgba(0, 255, 255, 0.6)',
    },
    card: {
      backgroundColor: '#1c1c1c',
      padding: '2rem',
      borderRadius: '12px',
      boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
      textAlign: 'center',
      maxWidth: '400px',
      margin: '0 auto',
    },
    description: {
      fontSize: '1.2rem',
      textAlign: 'center',
      marginBottom: '20px',
    },
    button: {
      padding: '10px 20px',
      fontSize: '1rem',
      color: '#fff',
      backgroundColor: '#0f8b8d',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      margin: '5px',
    },
    buttonN: {
      padding: '10px 20px',
      fontSize: '1rem',
      color: '#fff',
      backgroundColor: '#0f8b8d',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      margin: '5px',
    },
    input: {
      padding: '10px 20px',
      borderRadius: '5px',
      border: 'none',
      marginBottom: '5px',
      fontSize: '1rem',
      cursor: 'pointer',
      margin: '5px',
    },
    result: {
      marginTop: '1.5rem',
      fontSize: '1.5rem',
      color: '#39ff14',
    },
    error: {
      marginTop: '1.5rem',
      fontSize: '1.2rem',
      color: 'red',
    },
    animation: {
      marginTop: '3rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    line: {
      width: '200px',
      height: '2px',
      backgroundColor: '#0f8b8d',
      position: 'relative',
      animation: 'slide 2s infinite alternate',
    },
    circle: {
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      backgroundColor: '#39ff14',
      position: 'relative',
      animation: 'bounce 2s infinite ease-in-out',
      marginLeft: '0',
    },
    ibmQuantumBackend: {
      fontSize: '1.0rem',
      color: '#aaa',
      marginTop: '1rem',
    },
    healthIndicator: {
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      backgroundColor: 'red',
      position: 'relative',
      animation: 'bounce 2s infinite ease-in-out',
      marginLeft: '0',
    },
    spinner: {
      border: '4px solid rgba(0, 0, 0, 0.1)',
      borderTop: '4px solid #0f8b8d',
      borderRadius: '50%',
      width: '24px',
      height: '24px',
      animation: 'spin 1s linear infinite',
    },
    dots: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: '20px',
    },
    dot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: '#0f8b8d',
      margin: '0 4px',
      animation: 'dotFlashing 1s infinite linear alternate',
    },
    dot1: {
      animationDelay: '0s',
    },
    dot2: {
      animationDelay: '0.2s',
    },
    dot3: {
      animationDelay: '0.4s',
    },
    '@keyframes dotFlashing': {
      '0%': { opacity: 1 },
      '50%': { opacity: 0.3 },
      '100%': { opacity: 1 },
    },
    '@keyframes dotFlashing': {
      '0%': {
        opacity: 1,
      },
      '50%': {
        opacity: 0.3,
      },
      '100%': {
        opacity: 1,
      },
    },
    '@keyframes slide': {
      '0%': {
        transform: 'translateX(0)',
      },
      '100%': {
        transform: 'translateX(150px)',
      },
    },
    '@keyframes bounce': {
      '0%, 100%': {
        transform: 'translateY(0)',
      },
      '50%': {
        transform: 'translateY(-20px)',
      },
    },
    '@keyframes spin': {
      '0%': {
        transform: 'rotate(0deg)',
        },
      '100%': {
        transform: 'rotate(360deg)',
      },
    },
  };




