// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {FunctionsClient} from "@chainlink/contracts@1.2.0/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts@1.2.0/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts@1.2.0/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {LinkTokenInterface} from "@chainlink/contracts@1.2.0/src/v0.8/shared/interfaces/LinkTokenInterface.sol";
import {Chainlink, ChainlinkClient} from "@chainlink/contracts@1.2.0/src/v0.8/ChainlinkClient.sol";

/**
 * Request testnet LINK and ETH here: https://faucets.chain.link/
 * Find information on LINK Token Contracts and get the latest ETH and LINK faucets here: https://docs.chain.link/resources/link-token-contracts/
 */

/**
 * @title GettingStartedFunctionsConsumer
 * @notice This is an example contract to show how to make HTTP requests using Chainlink
 * @dev This contract uses hardcoded values and should not be used in production.
 */
contract QuantumOracle is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    // State variables to store the last request ID, response, and error
    bytes32 public s_lastRequestId;
    bytes public s_lastResponse;
    bytes public s_lastError;
    bytes32 private accessCodeHash; // Hash del código secreto

    // Custom error type
    error UnexpectedRequestID(bytes32 requestId);

    // Event to log responses
    event Response(
        bytes32 indexed requestId,
        string randomNumber,
        bytes response,
        bytes err
    );

    // Router address - Hardcoded for Sepolia
    // Check to get the router address for your supported network https://docs.chain.link/chainlink-functions/supported-networks
    address router = 0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0;

    // JavaScript source code
    // Fetch character name from the Star Wars API.
    // Documentation: https://swapi.info/people
    string source =
        "const response = await Functions.makeHttpRequest({"
        "url: `https://9b497939447c7727817519b3436736d4.serveo.net/generate_random`"
        "});"
        "if (response.error) {"
        "console.error(response.error);"
        "throw Error('Request failed');"
         "}"
         "const  data  = response.data.random_number;"
         "return Functions.encodeString(BigInt(data));";

    //Callback gas limit
    uint32 gasLimit = 300000;

    // donID - Hardcoded for Sepolia
    // Check to get the donID for your supported network https://docs.chain.link/chainlink-functions/supported-networks
    bytes32 donID =
        0x66756e2d6176616c616e6368652d66756a692d31000000000000000000000000;

    // State variable to store the returned character information
    string public randomNumber;

    /**
     * @notice Initializes the contract with the Chainlink router address and sets the contract owner
     */
    constructor(bytes32 _accessCodeHash) FunctionsClient(router) ConfirmedOwner(msg.sender) {
      _setChainlinkToken(0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846);
      accessCodeHash = _accessCodeHash; // Guardar el hash del código secreto
    }

    function setAccessCodeHash(bytes32 _newHash) public onlyOwner {
        accessCodeHash = _newHash;
    }

    /**
     * @notice Sends an HTTP request for character information
     * @param subscriptionId The ID for the Chainlink subscription
     * @return requestId The ID of the request
     */
    function sendRequest(
        uint64 subscriptionId,
        string memory _accessCode

    ) external onlyOwner returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source); // Initialize the request with JS code

        require(
            keccak256(abi.encodePacked(_accessCode)) == accessCodeHash,
            "Invalid access code"
        );

        // Send the request and store the request ID
        s_lastRequestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donID
        );

        return s_lastRequestId;
    }

    /**
     * @notice Callback function for fulfilling a request
     * @param requestId The ID of the request to fulfill
     * @param response The HTTP response data
     * @param err Any errors from the Functions request
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        if (s_lastRequestId != requestId) {
            revert UnexpectedRequestID(requestId); // Check if request IDs match
        }
        // Update the contract's state variables with the response and any errors
        s_lastResponse = response;
        randomNumber = string(response);
        s_lastError = err;

        // Emit an event to log the response
        emit Response(requestId, randomNumber, s_lastResponse, s_lastError);
    }

    function withdrawLink() public onlyOwner {
        LinkTokenInterface link = LinkTokenInterface(_chainlinkTokenAddress());
        require(
            link.transfer(msg.sender, link.balanceOf(address(this))),
            "Unable to transfer"
        );
    }
    function cancelRequest(
        bytes32 _requestId,
        uint256 _payment,
        bytes4 _callbackFunctionId,
        uint256 _expiration
    ) public onlyOwner {
        _cancelChainlinkRequest(
            _requestId,
            _payment,
            _callbackFunctionId,
            _expiration
        );
    }

    function stringToBytes32(
        string memory source
    ) private pure returns (bytes32 convertedResult) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }
        assembly {
            convertedResult := mload(add(source, 32))
        }
    }
}
