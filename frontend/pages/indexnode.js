import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import ExternalAdapterConsumerABI from '/Users/horaciocaceres/quantum_oracle_project/artifacts/contracts/QuantumOracle.sol/ExternalAdapterConsumer.json';

const CONTRACT_ADDRESS = "0x4fe5dBC3fce6748bF6A79bfE25945B9a719b0001";
const ORACLE_ADDRESS = "0x26311eA4EAA6676C91Ab3E122b78708eb00c81D4";
const JOB_ID = "938ebf40ba9b4dfabb50680ad34a9b8d";
const ACCESS_CODE = 'ag736ot'; // Replace with the actual access code

export default function Home() {
  const [randomNumber, setRandomNumber] = useState(null);
  const [backendName, setBackendName] = useState('Checking...');
  const [loadingRandom, setLoadingRandom] = useState(false);
  const [loadingBackend, setLoadingBackend] = useState(false);
  const [error, setError] = useState(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [networkCorrect, setNetworkCorrect] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [isOwner, setIsOwner] = useState(false);

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
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ExternalAdapterConsumerABI.abi, signer);

      const handleRandomNumberFulfilled = (requestId, result) => {
        console.log('Event emitted: RequestRandomNumberFulfilled');
        console.log('Request ID:', requestId);
        console.log('Raw result:', result);
        console.log('Formatted result:', result.toString());
        setRandomNumber(result.toString());
        setLoadingRandom(false);
      };

      contract.on('RequestRandomNumberFulfilled', handleRandomNumberFulfilled);

      return () => {
        contract.off('RequestRandomNumberFulfilled', handleRandomNumberFulfilled);
      };
    }
  }, [walletConnected]);

  async function requestRandomNumber() {
    if (loadingRandom) return;
    setLoadingRandom(true);
    setError(null);

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
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ExternalAdapterConsumerABI.abi, signer);

      console.log('Requesting random number...');
      console.log('Is owner:', isOwner);

      let tx;
      if (isOwner) {
        // Si es owner, usa una cadena vacía como código de acceso
        tx = await contract.requestRandomNumber(ORACLE_ADDRESS, JOB_ID, ACCESS_CODE);
      } else {
        // Si no es owner, verifica el código de acceso
        if (!accessCode) {
          throw new Error('Access code is required for non-owners');
        }
        tx = await contract.requestRandomNumber(ORACLE_ADDRESS, JOB_ID, accessCode);
      }

      console.log('Transaction sent:', tx.hash);

      await tx.wait();
      console.log('Transaction confirmed');

      // Listen for the RequestRandomNumberFulfilled event
      contract.once('RequestRandomNumberFulfilled', (requestId, result) => {
        console.log(`Random number fulfilled: ${result}`);
        setRandomNumber(result.toString());
        setLoadingRandom(false);
      });
    } catch (err) {
      console.error('Request failed:', err);
      setError('Error: ' + err.message);
      setLoadingRandom(false);
    }
  }

  async function checkIfOwner() {
    if (typeof window.ethereum !== 'undefined') {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ExternalAdapterConsumerABI.abi, signer);
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
    try {
      const response = await fetch('https://9b497939447c7727817519b3436736d4.serveo.net/backend_name');
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
  }

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
        <button onClick={requestRandomNumber} disabled={loadingRandom} style={{ ...styles.buttonN, width: '200px', textAlign: 'center'}}>
          {loadingRandom ? 'Processing...' : 'Get Random Number'}
        </button>
        <button onClick={fetchBackendName} disabled={loadingBackend} style={{ ...styles.buttonN, width: '200px', textAlign: 'center' }}>
          {loadingBackend ? 'Loading...' : 'Fetch Backend Name'}
        </button>
        {randomNumber !== null && (
          <p style={styles.result}>
            Random Number: {randomNumber.toString().padStart(3, '0')}
          </p>
        )}
        {error && <p style={styles.error}>{error}</p>}
      </div>
      <div style={styles.animation}>
        <div style={styles.line}></div>
        <div style={styles.circle}></div>
      </div>
      <p style={styles.ibmQuantumBackend}>
        IBM Quantum Backend: {backendName}
      </p>
      {!walletConnected && !connecting && (
        <button onClick={connectWallet} style={styles.button}>Connect Wallet</button>
      )}
      {connecting && <p>Connecting...</p>}
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
};
