// SPDX-License-Identifier: David Adefalu
pragma solidity ^0.8.1;

contract FlightSuretyData {
    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false

    mapping(address => bool) airlines; // List of all airlines for internal use. False if reg fee not paid

     struct  Airline {
        bool registrationFeePaid;
        address airlineAddress;
    }

    Airline[]  allAirline; // List of all airlines STRICTLY for populating the DAPP

    uint allRegisteredAirlineCount;

    struct Passenger {
        address airline;
        bytes32 flightKey;
        string flightNumber;
        uint timestamp;
        uint insuranceAmount;
    }

    mapping(bytes32 => Passenger) insuredPassengers;
    mapping(address => uint) passengersAccount;

    /********************************************************************************************/
    /*                                    EVENT DEFINITIONS                                     */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor()
    {
        contractOwner = msg.sender;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

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

    modifier requireIsAirlineRegistered(address account)
    {
        require(airlines[account]);
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */
    function isOperational()
                            public
                            view
                            returns(bool)
    {
        return operational;
    }

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */
    function isRegistered(address airlineAddress)
                            public
                            view
                            returns(bool)
    {
        return airlines[airlineAddress];
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */
    function setOperatingStatus(bool mode) external requireContractOwner
    {
        operational = mode;
    }

    function getAllAirlines() public view returns (Airline[] memory airlinesRegistered){
        airlinesRegistered = allAirline;
    }

    function getAirlineCount() external view returns (uint256)
    {
        return allRegisteredAirlineCount;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function registerAirline(address account) payable external returns (bool result)
    {

        Airline memory newAirline = Airline({
            registrationFeePaid: false,
            airlineAddress: account
        });

        allAirline.push(newAirline);

        //allRegisteredAirlineCount = allRegisteredAirlineCount + 1;

        airlines[account] = false;
        return true;
    }

    function registerFirstAirline(address account) external returns (bool result)
    {
        airlines[account] = true;

        Airline memory newAirline = Airline({
            registrationFeePaid: true,
            airlineAddress: account
        });

        //allRegisteredAirlineCount = allRegisteredAirlineCount + 1;

        allAirline.push(newAirline);
        return true;
    }

    /**
    * @dev Fee for registering an airline paid
    *      Can only be called from FlightSuretyApp contract
    */
    function markAsFeePaid(address account)
                            external
                            returns (bool result)
    {
        airlines[account] = true;

        for(uint i = 0; i < allAirline.length; i++)
        {
            if(allAirline[i].airlineAddress == account)
            {
                allAirline[i].registrationFeePaid = true;
            }
        }

        allRegisteredAirlineCount = allRegisteredAirlineCount + 1;
        return true;
    }

   /**
    * @dev Buy insurance for a flight
    *
    */
    function buy(address airline, string memory flightNumber, bytes32 flightKey, uint insuranceAmount, uint timestamp) external
    {
         insuredPassengers[flightKey] = Passenger({
            airline: airline,
            flightKey: flightKey,
            insuranceAmount: insuranceAmount,
            timestamp: timestamp,
            flightNumber: flightNumber
        });
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees(bytes32 flightKey) external
    {
        uint256 insuredAmount = insuredPassengers[flightKey].insuranceAmount;

        require(insuredAmount > 0);
        delete insuredPassengers[flightKey];
        uint256 insuranceToPay = insuredAmount * 3 / 2;
        passengersAccount[msg.sender] += insuranceToPay;
    }


    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay() external payable requireIsOperational
    {
        address payable senderPayableAddress = payable(msg.sender);

        uint256 availableBalance = passengersAccount[msg.sender];
        require(availableBalance > 0);
        delete passengersAccount[msg.sender];
        senderPayableAddress.transfer(availableBalance);
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */
    function fund() public payable requireIsOperational {
    }

    fallback() external payable requireIsOperational {
        fund();
    }

    receive() external payable requireIsOperational {
        revert("");
    }

    function getRegisteredAirlines() requireContractOwner view public returns(Airline[] memory registeredAirlines)
    {
       return allAirline;
    }
}


