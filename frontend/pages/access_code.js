const web3 = require('web3');
const { utils } = web3;

// Código de acceso
const accessCode = 'ag736ot';

// Generar hash del código de acceso
const accessCodeHash = utils.keccak256(accessCode);

console.log('Access Code Hash:', accessCodeHash);
