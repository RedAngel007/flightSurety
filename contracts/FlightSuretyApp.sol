// SPDX-License-Identifier: David Adefalu
pragma solidity ^0.8.1;
// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "./FlightSuretyData.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {

    FlightSuretyData flightSuretyData;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner;          // Account used to deploy contract
    bool private operational = true;        // Blocks all state changes throughout the contract if false
    bool private contractSetup;

   struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;
        address airline;
        string flightNumber;
        Passenger[] passengers;
    }

    struct Passenger {
        address passengerAddress;
        uint256 insuranceAmount;
    }

    mapping(address => bool) airlines;

    mapping(bytes32 => Flight) flights;
    mapping(address => address[]) registrationQueue;
    mapping(address => uint256) passengerBalance;
    //address[] multicalls;
    uint256 public constant regFee = 10 ether;
    uint256 public constant flightInsuranceFeeMax = 1000000000000000000 wei;
    uint8 oracleCount = 0;

    /********************************************************************************************/
    /*                                       EVENTS                                             */
    /********************************************************************************************/
    event AirlineRegistered(
        address airlineAddress,
        uint256 numberOfVotes,
        uint registeredAirlines
    );

    event AirlineVoted(
        address voter,
        uint256 registeredAirlinesCount,
        uint256 votersCount,
        uint256 threshold
    );

    event UpdatedVotersList(
        address[] voters
    );

    event AirlinePaidDeposit(
        address airlineAddress,
        uint256 contractBalanceBeforePayment,
        uint256 contractBalanceAfterPayment
    );

    event FirstAirlIneRegistered(address airlineAddress, uint256 numberOfVotes,
        uint registeredAirlines);

    event AirlinePaidRegistrationFee(address airlineAddress);

    event RegistrationQueueDeleted(address airlineAddress);

    event AirlineRegistrationRefused(
        address airlineAddress,
        uint8 numberOfVotes
    );

    event FlightRegistered(
        address airlineAddress,
        string flight,
        bytes32 key,
        uint256 timestamp
    );

    event PassengerDepositedInsurance(
        address passenger,
        bytes32 key,
        uint256 depositedAmount,
        uint256 totalDeposit
    );

    event LateAirlineInsuranceProcessed(
        string flight,
        bytes32 key
    );

    event InsuranceWithdrawal(
        address passenger,
        uint256 insuarancePaidBack
    );


    event RegisterFlightRequest(
        address indexed airline,
        string flight,
        uint256 timestamp
    );

    event FlightStatusUpdated(address airline, string flight, uint256 timestamp, uint8 status);

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.
      modifier requirePassengerShouldNotBeInsured(address airline, string memory flightNumber, uint256 timestamp)
    {
        bytes32 flightKey = getFlightKey(airline, flightNumber, timestamp);
        bool alreadyInsured = false;
        for(uint i = 0; i< flights[flightKey].passengers.length; i++)
        {
          if(flights[flightKey].passengers[i].passengerAddress == msg.sender)
          {
            alreadyInsured = true;
            break;
          }
        }

        require(!alreadyInsured, 'Passenger already insured');
        _;
    }


    modifier requireOneTimeCall() {
        require(!contractSetup, "Contract already setup");
        _;
    }

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational()
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /**
    * @dev require airline have more than 1 ether
    */
    modifier requireTenEtherToRegister(address account, uint256 msgValue)
    {
        require(account.balance > regFee, 'Account balance should be greater than 10 ether to register');
        require(msgValue >= regFee, '10 ether needed to pay registration fee');
        _;
    }

     /**
    * @dev require airline have more than 10 ether
    */
    modifier requireIsRegisteredAirline(address account)
    {
        require(flightSuretyData.isRegistered(account), "Airline is not registered");
        _;
    }

    modifier requireNotOracleAddress(address account)
    {
        require(oracles[account].isRegistered != true, "Address is an oracle address");
        _;
    }

    /**
    * @dev ensure multiple vote to register airline
    */
    modifier requireNotDuplicateRegisterCall(address airlineToRegister, address sender) {
        bool isDuplicate = false;

        address[] memory multicalls = registrationQueue[airlineToRegister];
        for(uint c = 0; c < multicalls.length; c++)
        {
            if(multicalls[c] == sender)
            {
                isDuplicate = true;
                break;
            }
        }

        require(!isDuplicate, "Address already votedUser already added to list");
        _;
    }

    modifier requireFlightNumberIsValid(string memory flight) {
        require(bytes(flight).length > 0, "Flight number not valid");
        _;
    }

    modifier requireLateAirlineStatusCode(bytes32 key) {
        require(
            flights[key].statusCode == STATUS_CODE_LATE_AIRLINE,
            "Only late airline is eligible for insurance release"
        );
        _;
    }

    modifier requireValidStatusCode(uint8 statusCode) {
         require(
            statusCode == STATUS_CODE_UNKNOWN ||
                statusCode == STATUS_CODE_ON_TIME ||
                statusCode == STATUS_CODE_LATE_AIRLINE ||
                statusCode == STATUS_CODE_LATE_WEATHER ||
                statusCode == STATUS_CODE_LATE_TECHNICAL ||
                statusCode == STATUS_CODE_LATE_OTHER,
            "Invalid status code"
        );
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
     */
    constructor()
    {
        contractOwner = msg.sender;
    }

    /********************************************************************************************/
    /*                                       SETUP FUNCTIONS                                  */
    /********************************************************************************************/
    function setUp(FlightSuretyData flightSuretyDataFromSetup, address firstAirline)
        public
        payable
        requireIsOperational()
        requireContractOwner()
        requireOneTimeCall()
    {
        require(
            msg.value >= regFee,
            "Airline registration fee is required"
        );
        contractSetup = true;
        flightSuretyData = FlightSuretyData(flightSuretyDataFromSetup);
        flightSuretyData.registerFirstAirline(firstAirline);

        // Return any excess RegFee above 10 ether
        if (msg.value > regFee) {
            payable(msg.sender).transfer(msg.value - regFee);
        }
        emit AirlineRegistered(
            firstAirline,
            0,
            flightSuretyData.getAirlineCount()
        );
    }

    function setupDataContract(address payable dataAddress) public
    {
        flightSuretyData = FlightSuretyData(dataAddress);
    }

    function registerFirstAirline(address airlineAddress) public
    {
        uint airlinesCount = flightSuretyData.getAirlineCount();
        require(airlinesCount == 0);
        flightSuretyData.registerFirstAirline(airlineAddress);
        airlinesCount += 1;

        emit FirstAirlIneRegistered(airlineAddress, 0, airlinesCount);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/
    /**
    * @dev Sets contract operations on/off
    * When operational mode is disabled, all write transactions except for this one will fail
    */
    function setOperatingStatus(bool mode) external requireContractOwner
    {
        operational = mode;
    }

    function isOperational()
                            public
                            view
                            returns(bool)
    {
        return operational;  // Modify to call data contract's status
    }


    function airlineIsRegistered(address airlineAddress)
                            public
                            view
                            returns(bool)
    {
        return flightSuretyData.isRegistered(airlineAddress);  // Modify to call data contract's status
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/


   /**
    * @dev Add an airline to the registration queue
    *
    */
    function registerAirline
                            (
                                address airlineAddress
                            )
                            external
                            requireNotOracleAddress(airlineAddress)
                            requireNotDuplicateRegisterCall(airlineAddress, msg.sender)
                            requireIsOperational
                            returns(bool success, uint256 votes)
    {
        success = false;
        votes = 0;

        uint256 airlinesCount  = flightSuretyData.getAirlineCount();

        if(airlinesCount <= 4) // Greater than 4 triggers consesus
        {
            flightSuretyData.registerAirline(airlineAddress);
            success = true;

            emit AirlineRegistered(airlineAddress, votes, airlinesCount);
        }

        else {
            registrationQueue[airlineAddress].push(msg.sender);
            emit UpdatedVotersList(registrationQueue[airlineAddress]);

            votes =  registrationQueue[airlineAddress].length;

            uint256 registeredAirlinesCount = flightSuretyData.getAirlineCount();

            uint256 votesThreshold = registeredAirlinesCount -  votes;
            emit AirlineVoted(msg.sender,registeredAirlinesCount, votes, votesThreshold);

            if(votes >= votesThreshold)
            {
                delete registrationQueue[airlineAddress];
                emit RegistrationQueueDeleted(airlineAddress);

                flightSuretyData.registerAirline(airlineAddress);
                emit AirlineRegistered(airlineAddress, votes, airlinesCount);
            }
        }
    }

    function payAirlineRegisterationFee(address airlineAddress)
        public
        payable
        requireIsOperational
        returns (bool success) {
        require(msg.value >= regFee, 'Airline registration fee should be >= 10 eth');
        bool isRegistered = flightSuretyData.isRegistered(airlineAddress);
        require(!isRegistered, 'Only airlines in Registration Queue can stake 10 eth');
        success = flightSuretyData.markAsFeePaid(airlineAddress);

        emit AirlinePaidRegistrationFee(airlineAddress);
    }

    function getPassengerWithdrawableBalance(address passenger) public view returns(uint256)
    {
        return passengerBalance[passenger];
    }

    /**
    * @dev Pay for flight insurance
    *
    */
    function insurePassenger(address airline, string memory flightNumber, uint256 timestamp, uint256 insuranceAmount)
        public
        payable
        requireIsOperational
        requirePassengerShouldNotBeInsured(airline, flightNumber, timestamp)
        returns (bool success)
    {
        require(msg.sender.balance > flightInsuranceFeeMax);
        bytes32 flightKey = getFlightKey(airline, flightNumber, timestamp);
        require(flights[flightKey].statusCode ==  STATUS_CODE_UNKNOWN, 'Insurance can only be purchased for flights with status unknown'); // You can only insure b4 flight takes off        success = false;

        uint paidInsuranceAmount  = msg.value;

        flightSuretyData.buy(airline, flightNumber, flightKey,  insuranceAmount, timestamp);

        if(msg.value > flightInsuranceFeeMax)
        {
            paidInsuranceAmount = flightInsuranceFeeMax;
            payable(msg.sender).transfer(insuranceAmount - flightInsuranceFeeMax);
        }

        Passenger memory passenger = Passenger({insuranceAmount: paidInsuranceAmount, passengerAddress: msg.sender});
        flights[flightKey].passengers.push(passenger);
        success = true;
        passengerBalance[msg.sender] += 0;
        emit PassengerDepositedInsurance(msg.sender, flightKey, insuranceAmount, address(this).balance);
    }


    /**
    * @dev Register a future flight
    */
      function registerFlight(
        address airlineAddress,
        string memory flight,
        uint256 timestamp
    )
        public
         requireIsOperational()
         requireFlightNumberIsValid(flight)
         requireIsRegisteredAirline(airlineAddress)
         returns(bool success)
    {
        success = false;
        bytes32 key = getFlightKey(airlineAddress, flight, timestamp);
        Flight storage newflight = flights[key];
        require(!newflight.isRegistered, "Cannot register an existing flight");
        newflight.isRegistered = true;
        newflight.statusCode = STATUS_CODE_UNKNOWN;
        newflight.updatedTimestamp = timestamp;
        newflight.airline = airlineAddress;
        newflight.flightNumber = flight;

        emit FlightRegistered(airlineAddress, flight, key, timestamp);

        return true;
    }

    /**
    * @dev Called after oracle has updated flight status
    *
    */
    function ProcessFlightStatus(address airline, string memory flight, uint256 timestamp, uint8 status)
        public
        requireIsOperational
        requireValidStatusCode(status)
    {
        bytes32 key = getFlightKey(airline, flight, timestamp);
        require(flights[key].statusCode != status);

        flights[key].statusCode = status;
        emit FlightStatusUpdated(airline, flight, timestamp, status);

        if(status == STATUS_CODE_LATE_AIRLINE)
        {
            for(uint i = 0; i < flights[key].passengers.length; i++)
            {
               address passengerAddress =   flights[key].passengers[i].passengerAddress;
               uint insuranceFeePaid = flights[key].passengers[i].insuranceAmount;

               passengerBalance[passengerAddress] += (insuranceFeePaid * 3 / 2 );
            }
            emit LateAirlineInsuranceProcessed(flights[key].flightNumber, key);
        }
    }

    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(address airline, string memory flight, uint256 timestamp)
        external
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = getFlightKey(airline, flight, timestamp);

        ResponseInfo storage responseInfo = oracleResponses[key];
        responseInfo.requester = msg.sender;
        responseInfo.isOpen = true;

        emit OracleRequest(index, airline, flight, timestamp);
    }

    function withdrawBalance(address payable passengerAddress) public  {
        uint256 balance = passengerBalance[passengerAddress];
        require(balance > 0, 'Your balance is less than 0');
        if(balance > 0) {
            passengerBalance[passengerAddress] = 0;

            passengerAddress.transfer(balance);

            emit InsuranceWithdrawal(passengerAddress, balance);
        }
    }

    function fetchFlightStatusCode(address airline, string memory flight, uint256 timestamp) public view returns(uint8)
    {
        bytes32 key = getFlightKey(airline, flight, timestamp);
        return flights[key].statusCode;
    }

    // region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;

    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);

    event OracleRegistered(address oracleAddress, uint256 registrationFee, uint8[3] indexes);

    // Register an oracle with the contract
    // Todo make sure its not a airline, flight or passenger address
    function registerOracle()
        external
        payable
    {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");
        uint8[3] memory indexes = generateIndexes(msg.sender);
        oracles[msg.sender] = Oracle({ isRegistered: true, indexes: indexes });
        oracleCount += 1;
        emit  OracleRegistered(msg.sender, msg.value, indexes);
    }

    function isOracleRegistered(address oracleAddress) public view returns(bool isRegistered)
    {
        return oracles[oracleAddress].isRegistered;
    }

    function getMyIndexes()
                view
                            external
                            returns(uint8[3] memory)
    {
       require(oracles[msg.sender].isRegistered, "Oracle is not registered");

        return oracles[msg.sender].indexes;
    }

    function getOracleCount() public view returns (uint count) {
        return oracleCount;
    }

    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse
                        (
                            uint8 index,
                            address airline,
                            string memory flight,
                            uint256 timestamp,
                            uint8 statusCode
                        )
                        external
                        requireValidStatusCode(statusCode)

    {
        require(
            (oracles[msg.sender].indexes[0] == index) ||
            (oracles[msg.sender].indexes[1] == index) ||
            (oracles[msg.sender].indexes[2] == index),
            "Index does not match oracle request");

        bytes32 key = keccak256(abi.encodePacked(airline, flight, timestamp));
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flight, timestamp, statusCode);


            // Handle flight status as appropriate
            ProcessFlightStatus(airline, flight, timestamp, statusCode);
        }
    }

    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32)
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes
                            (
                                address account
                            )
                            internal
                            returns(uint8[3] memory)
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);

        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex
                            (
                                address account
                            )
                            internal
                            returns (uint8)
    {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

}
