// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title LostAndFound - A decentralized lost and found board
/// @notice Users can report lost or found items on the blockchain.
///         The original reporter can mark an item as returned/resolved.
contract LostAndFound {

    // ── Enums ──────────────────────────────────────────────
    enum ItemStatus { Open, Resolved }
    enum ItemType   { Lost, Found }

    // ── Structs ────────────────────────────────────────────
    struct Item {
        uint256   id;
        address   reporter;
        string    title;
        string    description;
        string    location;
        string    contactInfo;
        ItemType  itemType;
        ItemStatus status;
        uint256   timestamp;
    }

    // ── State variables ────────────────────────────────────
    address public owner;              // Contract deployer / admin
    uint256 public itemCount;          // Total items reported
    mapping(uint256 => Item) public items;   // id => Item

    // ── Events ─────────────────────────────────────────────
    event ItemReported(
        uint256 indexed id,
        address indexed reporter,
        string  title,
        ItemType itemType,
        uint256 timestamp
    );
    event ItemResolved(uint256 indexed id, address indexed resolver, uint256 timestamp);

    // ── Modifiers ──────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Only contract owner can call this");
        _;
    }

    modifier onlyReporter(uint256 _id) {
        require(_id > 0 && _id <= itemCount, "Item does not exist");
        require(msg.sender == items[_id].reporter, "Only the original reporter can do this");
        _;
    }

    modifier itemExists(uint256 _id) {
        require(_id > 0 && _id <= itemCount, "Item does not exist");
        _;
    }

    // ── Constructor ────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ── Core functions ─────────────────────────────────────

    /// @notice Report a lost or found item
    /// @param _title       Short title (max 100 chars)
    /// @param _description Detailed description (max 500 chars)
    /// @param _location    Where the item was lost/found
    /// @param _contactInfo How to reach the reporter
    /// @param _itemType    0 = Lost, 1 = Found
    function reportItem(
        string memory _title,
        string memory _description,
        string memory _location,
        string memory _contactInfo,
        ItemType _itemType
    ) public {
        // ── Input validation ──
        require(bytes(_title).length > 0 && bytes(_title).length <= 100,
                "Title must be 1-100 characters");
        require(bytes(_description).length > 0 && bytes(_description).length <= 500,
                "Description must be 1-500 characters");
        require(bytes(_location).length > 0,
                "Location cannot be empty");
        require(bytes(_contactInfo).length > 0,
                "Contact info cannot be empty");

        itemCount++;

        items[itemCount] = Item({
            id:          itemCount,
            reporter:    msg.sender,
            title:       _title,
            description: _description,
            location:    _location,
            contactInfo: _contactInfo,
            itemType:    _itemType,
            status:      ItemStatus.Open,
            timestamp:   block.timestamp
        });

        emit ItemReported(itemCount, msg.sender, _title, _itemType, block.timestamp);
    }

    /// @notice Mark an item as resolved/returned (only original reporter)
    /// @param _id The item ID to resolve
    function resolveItem(uint256 _id) public onlyReporter(_id) {
        require(items[_id].status == ItemStatus.Open, "Item is already resolved");
        items[_id].status = ItemStatus.Resolved;
        emit ItemResolved(_id, msg.sender, block.timestamp);
    }

    /// @notice Get full details of an item
    /// @param _id The item ID
    function getItem(uint256 _id) public view itemExists(_id) returns (
        uint256   id,
        address   reporter,
        string memory title,
        string memory description,
        string memory location,
        string memory contactInfo,
        ItemType  itemType,
        ItemStatus status,
        uint256   timestamp
    ) {
        Item storage item = items[_id];
        return (
            item.id,
            item.reporter,
            item.title,
            item.description,
            item.location,
            item.contactInfo,
            item.itemType,
            item.status,
            item.timestamp
        );
    }

    /// @notice Get the total number of items
    function getItemCount() public view returns (uint256) {
        return itemCount;
    }

    /// @notice Admin-only: force-resolve an item (e.g. spam removal)
    /// @param _id The item ID to resolve
    function adminResolve(uint256 _id) public onlyOwner itemExists(_id) {
        require(items[_id].status == ItemStatus.Open, "Item is already resolved");
        items[_id].status = ItemStatus.Resolved;
        emit ItemResolved(_id, msg.sender, block.timestamp);
    }
}
