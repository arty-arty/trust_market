// Trust Marketplace
// P2P Gig Marketplace with encrypted chat functionality

module trust::marketplace {
    use std::string::String;
    use std::vector;
    use std::option::{Self, Option};
    use sui::{clock::Clock, coin::{Self, Coin}, dynamic_field as df, random::{Self, Random, RandomGenerator}, sui::SUI, table::{Self, Table}, object::{Self, ID, UID}, transfer, tx_context::{Self, TxContext}};
    use trust::utils::is_prefix;
    use std::vector::append;
    use sui::bcs::{to_bytes};

    const EInvalidCap: u64 = 0;
    const EInvalidAmount: u64 = 1;
    const ENoAccess: u64 = 2;
    const EInvalidState: u64 = 3;
    const ENotAuthorized: u64 = 4;
    const EInvalidRating: u64 = 5;
    const MARKER: u64 = 6;
    const EInteractionNotFound: u64 = 7;
    const EAlreadyJoined: u64 = 8;
    const EEmptyAdminList: u64 = 9;

    // Advertisement states
    const STATE_AVAILABLE: u8 = 0;
    const STATE_JOINED: u8 = 1;
    const STATE_COMPLETED: u8 = 2;
    const STATE_DISPUTED: u8 = 3;

    // Interaction states
    const INTERACTION_JOINED: u8 = 0;
    const INTERACTION_SELLER_COMPLETED: u8 = 1;
    const INTERACTION_BUYER_APPROVED: u8 = 2;
    const INTERACTION_DISPUTED: u8 = 3;

    // Resolution types
    const RESOLUTION_PEACEFUL: u8 = 0;
    const RESOLUTION_ADMIN_BUYER: u8 = 1;
    const RESOLUTION_ADMIN_SELLER: u8 = 2;
    const RESOLUTION_ADMIN_SPLIT: u8 = 3;

/// Registry to keep track of all statistics and reputation of users
public struct StatsRegistry has key {
    id: UID,
    advertisements: vector<ID>, // Vector of advertisement IDs
    // In production, a smart table based indexing would be used to avoid overflow
}

/// Registry to keep track of all advertisements
public struct AdvertisementRegistry has key {
    id: UID,
    advertisements: vector<ID>, // Vector of advertisement IDs
    // In production, a smart table based indexing would be used to avoid overflow
}

public struct UserProfile has store {
    user: address,
    interactions: vector<Interaction>,
}

public struct Advertisement has key {
    id: UID,
    creator: address,
    title: String,
    description: String,
    amount: u64,
    created_at: u64,

    // Table mapping user address to their profile containing interactions
    user_profiles: Table<address, UserProfile>,
}

public struct Interaction has store {
    id: u64,  // Unique identifier within a user's interactions
    user: address,
    joined_at: u64,
    payment: Coin<SUI>,  // Embedded escrow payment
    seller: address,
    assigned_admin: address,
    chat_messages: vector<ChatMessage>,
    chat_ephemeral_key_encrypted: vector<u8>,
    state: u8,
}

public struct ChatMessage has key, store {
    id: UID,
    advertisement_id: ID,
    interaction_user: address,
    interaction_id: u64,  // Added to identify which interaction this message belongs to
    sender: address,
    timestamp: u64,
    message_encrypted_text: Option<String>,
    message_blob_id: Option<String>,
}

public struct UserReputation has key {
    id: UID,
    user: address,
    rating_sum: u64,
    rating_count: u64,
    total_volume: u64,
    total_deals: u64,
    peaceful_resolutions: u64,
    disputed_deals: u64,
    created_at: u64,
    last_active: u64,
}

public struct Review has key {
    id: UID,
    transaction_id: ID,
    reviewer: address,
    reviewed: address,
    rating: u64,
    comment: String,
    timestamp: u64,
    resolution_type: u8,
}

public struct MarketplaceCap has key {
    id: UID,
    advertisement_id: ID,
}

    //////////////////////////////////////////
    /////// Advertisement Registry Management

/// Initialize the advertisement registry
/// This should be called once when the module is published
public fun initialize_registry(ctx: &mut TxContext) {
    let registry = AdvertisementRegistry {
        id: object::new(ctx),
        advertisements: vector::empty(),
    };
    
    transfer::share_object(registry);
}

/// Add an advertisement to the registry
public fun add_to_registry(registry: &mut AdvertisementRegistry, advertisement_id: ID) {
    vector::push_back(&mut registry.advertisements, advertisement_id);
}

/// Get all advertisement IDs from the registry
public fun get_all_advertisements(registry: &AdvertisementRegistry): vector<ID> {
    registry.advertisements
}

    //////////////////////////////////////////
    /////// Advertisement Management

/// Create a new advertisement
public fun create_advertisement(
    registry: &mut AdvertisementRegistry,
    title: String,
    description: String,
    amount: u64,
    c: &Clock,
    ctx: &mut TxContext
): MarketplaceCap {
    let advertisement = Advertisement {
        id: object::new(ctx),
        creator: ctx.sender(),
        title,
        description,
        amount,
        created_at: c.timestamp_ms(),
        user_profiles: table::new(ctx), // Initialize empty table
    };
    
    let advertisement_id = object::id(&advertisement);
    
    // Add the advertisement to the registry
    add_to_registry(registry, advertisement_id);
    
    let cap = MarketplaceCap {
        id: object::new(ctx),
        advertisement_id,
    };
    
    transfer::share_object(advertisement);
    cap
}

    // Convenience function to create an advertisement and send the cap to the sender
    entry fun create_advertisement_entry(
        registry: &mut AdvertisementRegistry,
        title: String,
        description: String,
        amount: u64,
        c: &Clock,
        ctx: &mut TxContext
    ) {
        transfer::transfer(create_advertisement(registry, title, description, amount, c, ctx), ctx.sender());
    }

/// Join an advertisement and lock funds in escrow
entry fun join_advertisement_entry(
    advertisement: &mut Advertisement,
    payment: Coin<SUI>,
    chat_ephemeral_key_encrypted: vector<u8>,
    c: &Clock,
    r: &Random,
    ctx: &mut TxContext
) {
    let sender = ctx.sender();
    
    // Verify payment amount matches advertisement amount
    assert!(coin::value(&payment) == advertisement.amount, EInvalidAmount);
    
    // Check if user already has a profile
    if (table::contains(&advertisement.user_profiles, sender)) {
        let profile = table::borrow(&advertisement.user_profiles, sender);
        
        // Check if user has any interactions
        if (!vector::is_empty(&profile.interactions)) {
            // Get the last interaction
            let last_interaction = vector::borrow(&profile.interactions, vector::length(&profile.interactions) - 1);
            
            // Verify last interaction is completed
            assert!(last_interaction.state == INTERACTION_BUYER_APPROVED, EInvalidState);
        }
    };
    
    // Select a random admin
    let assigned_admin = select_random_admin(r, ctx);
    
    // Create a new interaction with embedded payment
    let interaction = Interaction {
        id: get_next_interaction_id(advertisement, sender),
        user: sender,
        joined_at: c.timestamp_ms(),
        payment,
        seller: advertisement.creator,
        assigned_admin,
        state: INTERACTION_JOINED,
        chat_messages: vector::empty(),
        chat_ephemeral_key_encrypted,
    };
    
    // Add to user profile
    if (!table::contains(&mut advertisement.user_profiles, sender)) {
        // Create new profile if it doesn't exist
        let profile = UserProfile {
            user: sender,
            interactions: vector::empty(),
        };
        table::add(&mut advertisement.user_profiles, sender, profile);
    };
    
    // Get the profile and add the new interaction
    let profile = table::borrow_mut(&mut advertisement.user_profiles, sender);
    vector::push_back(&mut profile.interactions, interaction);
}

/// Get the next interaction ID for a user
fun get_next_interaction_id(advertisement: &Advertisement, user: address): u64 {
    if (!table::contains(&advertisement.user_profiles, user)) {
        return 0
    };
    
    let profile = table::borrow(&advertisement.user_profiles, user);
    vector::length(&profile.interactions)
}

    /// Select a random admin from a hardcoded list of example addresses
    /// Random has a reserved address 0x8. See random.move for the Move APIs for accessing randomness on Sui.
    fun select_random_admin(r: &Random, ctx: &mut TxContext): address {
        let mut generator = random::new_generator(r, ctx);
        let mut admin_list: vector<address> = vector::empty();
        
        // Add hardcoded admin addresses
        vector::push_back(&mut admin_list, @0x1); // Example address
        vector::push_back(&mut admin_list, @0x2); // Example address
        
        // Check if the admin list is empty, might be useful later when dynamic list will be used
        assert!(!vector::is_empty(&admin_list), EEmptyAdminList);
        
        // Select a random admin from the list
        let random_index = random::generate_u8_in_range(&mut generator, 0, (vector::length(&admin_list) - 1) as u8);
        *vector::borrow(&admin_list, random_index as u64)
    }

/// Mark a transaction as completed (by seller)
public fun mark_completed(
    advertisement: &mut Advertisement,
    user_address: address, // Specify which user's interaction to mark
    interaction_id: u64, // Specify which interaction to mark
    ctx: &TxContext
) {
    // Verify sender is the creator
    assert!(advertisement.creator == ctx.sender(), ENotAuthorized);
    
    // Verify the user profile exists
    assert!(table::contains(&advertisement.user_profiles, user_address), EInteractionNotFound);
    
    // Get the user profile
    let profile = table::borrow_mut(&mut advertisement.user_profiles, user_address);
    
    // Verify the interaction exists
    assert!(interaction_id < vector::length(&profile.interactions), EInteractionNotFound);
    
    // Get the interaction
    let interaction = vector::borrow_mut(&mut profile.interactions, interaction_id);
    
    // Verify interaction is in JOINED state
    assert!(interaction.state == INTERACTION_JOINED, EInvalidState);
    
    // Update state to SELLER_COMPLETED
    interaction.state = INTERACTION_SELLER_COMPLETED;
}

// Convenience function to mark a transaction as completed
entry fun mark_completed_entry(
    advertisement: &mut Advertisement,
    user_address: address,
    interaction_id: u64,
    ctx: &mut TxContext
) {
    mark_completed(advertisement, user_address, interaction_id, ctx);
}

/// Release payment (by buyer)
public fun release_payment(
    advertisement: &mut Advertisement,
    interaction_id: u64, // Specify which interaction to release payment for
    ctx: &mut TxContext
) {
    let sender = ctx.sender();
    
    // Verify the user profile exists
    assert!(table::contains(&advertisement.user_profiles, sender), EInteractionNotFound);
    
    // Get the user profile
    let profile = table::borrow_mut(&mut advertisement.user_profiles, sender);
    
    // Verify the interaction exists
    assert!(interaction_id < vector::length(&profile.interactions), EInteractionNotFound);
    
    // Get the interaction
    let interaction = vector::borrow_mut(&mut profile.interactions, interaction_id);
    
    // Verify sender is the buyer (user in interaction)
    assert!(interaction.user == sender, ENotAuthorized);
    
    // Verify interaction is in SELLER_COMPLETED or DISPUTED state
    assert!((interaction.state == INTERACTION_SELLER_COMPLETED) || (interaction.state == INTERACTION_DISPUTED), EInvalidState);
    
    // Update state to BUYER_APPROVED
    interaction.state = INTERACTION_BUYER_APPROVED;

    //Now take the escrow and send the funds to the advertisement creator
    let advertisement_creator = advertisement.creator;
    let amount = coin::value(&interaction.payment);
    assert!(amount > 0, EInvalidAmount);
    sui::pay::split_and_transfer(&mut interaction.payment, amount, advertisement_creator, ctx)
}

// Convenience function to release payment
entry fun release_payment_entry(
    advertisement: &mut Advertisement,
    interaction_id: u64,
    ctx: &mut TxContext
) {
    release_payment(advertisement, interaction_id, ctx);
}

/// Dispute a transaction (by buyer or seller)
public fun dispute_transaction(
    advertisement: &mut Advertisement,
    user_address: address, // The user whose interaction to dispute
    interaction_id: u64, // Specify which interaction to dispute
    ctx: &TxContext
) {
    let sender = ctx.sender();
    
    // Verify the user profile exists
    assert!(table::contains(&advertisement.user_profiles, user_address), EInteractionNotFound);
    
    // Get the user profile
    let profile = table::borrow_mut(&mut advertisement.user_profiles, user_address);
    
    // Verify the interaction exists
    assert!(interaction_id < vector::length(&profile.interactions), EInteractionNotFound);
    
    // Get the interaction
    let interaction = vector::borrow_mut(&mut profile.interactions, interaction_id);
    
    // Verify sender is authorized (either the buyer or the seller)
    assert!(
        sender == interaction.user || sender == advertisement.creator,
        ENotAuthorized
    );
    
    // Verify interaction is not finished
    assert!(!(interaction.state == INTERACTION_BUYER_APPROVED), EInvalidState);
    
    // Update state to DISPUTED
    interaction.state = INTERACTION_DISPUTED;
}

// Convenience function to dispute a transaction
entry fun dispute_transaction_entry(
    advertisement: &mut Advertisement,
    user_address: address,
    interaction_id: u64,
    ctx: &mut TxContext
) {
    dispute_transaction(advertisement, user_address, interaction_id, ctx);
}

    //////////////////////////////////////////
    /////// Chat Functionality

/// Add a chat message
public fun add_chat_message(
    advertisement: &mut Advertisement,
    user_address: address, // The user whose interaction to add the message to
    interaction_id: u64, // Specify which interaction to add the message to
    message_blob_id: Option<String>,
    message_encrypted_text: Option<String>,
    c: &Clock,
    ctx: &mut TxContext
) {
    let sender = ctx.sender();
    
    // Verify the user profile exists
    assert!(table::contains(&advertisement.user_profiles, user_address), EInteractionNotFound);
    
    // Get the advertisement ID
    let advertisement_id = object::id(advertisement);

    // Get the user profile
    let profile = table::borrow_mut(&mut advertisement.user_profiles, user_address);
    
    // Verify the interaction exists
    assert!(interaction_id < vector::length(&profile.interactions), EInteractionNotFound);
    
    // Get the interaction
    let interaction = vector::borrow_mut(&mut profile.interactions, interaction_id);
    
    // Verify sender is authorized (creator, user in interaction, or assigned admin)
    assert!(
        sender == advertisement.creator || 
        sender == user_address ||
        sender == interaction.assigned_admin,
        ENotAuthorized
    );
    
    let message = ChatMessage {
        id: object::new(ctx),
        advertisement_id,
        interaction_user: user_address,
        interaction_id,
        sender,
        timestamp: c.timestamp_ms(),
        message_encrypted_text,
        message_blob_id,
    };

    // Add the chat message to interaction
    interaction.chat_messages.push_back(message);
}

// Convenience function to add a chat message
entry fun add_chat_message_entry(
    advertisement: &mut Advertisement,
    user_address: address,
    interaction_id: u64,
    message_blob_id: Option<String>,
    message_encrypted_text: Option<String>,
    c: &Clock,
    ctx: &mut TxContext
) {
    add_chat_message(
        advertisement,
        user_address,
        interaction_id,
        message_blob_id,
        message_encrypted_text,
        c,
        ctx
    );
}

    // TODO: Fix later by creating a registry on contract published with a Table of all UserReputations (can be called
    // GlobalUserInfoRegistry)
    // It can be passed when creating a new add to copy the rating, and other dealer information
    // to be easily visible for the user
    // Also passed when a new interaction is created, for the same reason
    // And of course on any resolution or review
    // To actually update the reputation

    //////////////////////////////////////////
    /////// Reputation System

    /// Initialize user reputation
    public fun initialize_reputation(
        user: address,
        c: &Clock,
        ctx: &mut TxContext
    ) {
        let reputation = UserReputation {
            id: object::new(ctx),
            user,
            rating_sum: 0,
            rating_count: 0,
            total_volume: 0,
            total_deals: 0,
            peaceful_resolutions: 0,
            disputed_deals: 0,
            created_at: c.timestamp_ms(),
            last_active: c.timestamp_ms(),
        };
        
        transfer::share_object(reputation);
    }

    /// Add a review after peaceful resolution
    public fun add_peaceful_review(
        transaction_id: ID,
        reviewer: address,
        reviewed: address,
        rating: u64,
        comment: String,
        reputation: &mut UserReputation,
        c: &Clock,
        ctx: &mut TxContext
    ) {
        // Verify rating is between 1 and 5
        assert!(rating >= 1 && rating <= 5, EInvalidRating);
        
        // Verify reputation is for the reviewed user
        assert!(reputation.user == reviewed, ENotAuthorized);
        
        let review = Review {
            id: object::new(ctx),
            transaction_id,
            reviewer,
            reviewed,
            rating,
            comment,
            timestamp: c.timestamp_ms(),
            resolution_type: RESOLUTION_PEACEFUL,
        };
        
        // Update reputation stats
        reputation.rating_sum = reputation.rating_sum + rating;
        reputation.rating_count = reputation.rating_count + 1;
        reputation.total_deals = reputation.total_deals + 1;
        reputation.peaceful_resolutions = reputation.peaceful_resolutions + 1;
        reputation.last_active = c.timestamp_ms();
        
        transfer::share_object(review);
    }

    /// Add a review after disputed resolution
    public fun add_disputed_review(
        transaction_id: ID,
        reviewer: address,
        reviewed: address,
        rating: u64,
        comment: String,
        resolution_type: u8,
        reputation: &mut UserReputation,
        c: &Clock,
        ctx: &mut TxContext
    ) {
        // Verify rating is between 1 and 5
        assert!(rating >= 1 && rating <= 5, EInvalidRating);
        
        // Verify reputation is for the reviewed user
        assert!(reputation.user == reviewed, ENotAuthorized);
        
        // Verify resolution type is valid
        assert!(
            resolution_type == RESOLUTION_ADMIN_BUYER || 
            resolution_type == RESOLUTION_ADMIN_SELLER || 
            resolution_type == RESOLUTION_ADMIN_SPLIT,
            EInvalidState
        );
        
        let review = Review {
            id: object::new(ctx),
            transaction_id,
            reviewer,
            reviewed,
            rating,
            comment,
            timestamp: c.timestamp_ms(),
            resolution_type,
        };
        
        // Update reputation stats
        reputation.rating_sum = reputation.rating_sum + rating;
        reputation.rating_count = reputation.rating_count + 1;
        reputation.total_deals = reputation.total_deals + 1;
        reputation.disputed_deals = reputation.disputed_deals + 1;
        reputation.last_active = c.timestamp_ms();
        
        transfer::share_object(review);
    }

    /// Update total volume for a user
    public fun update_volume(
        reputation: &mut UserReputation,
        amount: u64,
        c: &Clock
    ) {
        reputation.total_volume = reputation.total_volume + amount;
        reputation.last_active = c.timestamp_ms();
    }

    //////////////////////////////////////////
    /////// Admin Functions
    
    /// For now admins will be hardcoded and randomly selected during assignment
    /// procedure, but in the future we can add a registry of admins who have the
    /// capability to resolve disputes
    ///
    /// Create an admin capability
    // public fun create_admin_cap(ctx: &mut TxContext): AdminCap {
    //     AdminCap {
    //         id: object::new(ctx),
    //     }
    // }

    //////////////////////////////////////////
    /////// Access Control for Encrypted Messages
    /// Key would be [package_id]::[advertisement_id][user_id][interaction_id]
    /// Check if a user has access to a message
fun approve_internal(id: vector<u8>, caller: address, advertisement: &Advertisement, user: address, interaction_id: u64): bool {

    // Check if the id has the right prefix
    let mut namespace = advertisement.id.to_bytes();
    let user_id = user.to_bytes();
    let interaction_id_vec = to_bytes(&interaction_id);

    // Concatenate the advertisement ID with the user ID and interaction ID
    vector::append(&mut namespace, user_id);
    vector::append(&mut namespace, interaction_id_vec);

    //Check if the id has the right prefix
    //The random_nonce addition is still possible, but unnecessary for the current implementation
    if (!is_prefix(namespace, id)) {
        return false
    };

    // Check if caller is the creator
    if (advertisement.creator == caller) {
        return true
    };
     
    // Check if caller is the user
    if (caller == user) {
        return true
    };

    // Check if the user has a profile
    if (!table::contains(&advertisement.user_profiles, user)) {
        return false
    };

    // Get the user profile
    let profile = table::borrow(&advertisement.user_profiles, user);
    
    // Check if user has any interactions
    if (vector::is_empty(&profile.interactions)) {
        return false
    };
    
    // Check if the interaction exists
    if (interaction_id >= vector::length(&profile.interactions)) {
        return false
    };

    // Get the user interaction at his user id
    let interaction = vector::borrow(&profile.interactions, interaction_id);

    // This is key feature of the marketplace
    // Admins can only access messages if the interaction is disputed
    // In real world with high-rating sellers, 
    // who have close to zero disputes - this would never happen
    // That's why the marketplace is truly private
    
    // Check if user is the assigned admin and interaction is being disputed
    if (interaction.assigned_admin == caller && interaction.state == INTERACTION_DISPUTED) {
        return true
    };
    
    // For simplicity, just return false for all other cases
    false
}

entry fun seal_approve(id: vector<u8>, advertisement: &Advertisement, user: address, interaction_id : u64, ctx: &TxContext) {
    // Use internal approval function
    if (approve_internal(id, ctx.sender(), advertisement, user, interaction_id)) {
        return
    };
    // If we get here, the user doesn't have access
    abort ENoAccess
}

    /// Publish a blob ID to the advertisement
    public fun publish(
        advertisement: &mut Advertisement,
        cap: &MarketplaceCap,
        blob_id: String
    ) {
        assert!(cap.advertisement_id == object::id(advertisement), EInvalidCap);
        df::add(&mut advertisement.id, blob_id, MARKER);
    }
}
